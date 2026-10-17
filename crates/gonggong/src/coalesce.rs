use futures_util::FutureExt;
use futures_util::future::{BoxFuture, Shared};
use std::collections::HashMap;
use std::future::Future;
use std::hash::Hash;
use std::sync::Mutex;
use std::time::Duration;
use tokio::time::Instant;

/// Callers asking for the same key while it is being computed share that one computation; with a TTL, its result
/// also answers the key until it is that old.
pub struct Coalesce<K, V: Clone> {
    state: Mutex<State<K, V>>,
    ttl: Duration,
}

struct State<K, V: Clone> {
    inflight: HashMap<K, Shared<BoxFuture<'static, V>>>,
    done: HashMap<K, (Instant, V)>,
}

impl<K, V: Clone> Default for Coalesce<K, V> {
    fn default() -> Self {
        Self::with_ttl(Duration::ZERO)
    }
}

impl<K, V: Clone> Coalesce<K, V> {
    pub fn with_ttl(ttl: Duration) -> Self {
        Self { state: Mutex::new(State { inflight: HashMap::new(), done: HashMap::new() }), ttl }
    }
}

impl<K: Hash + Eq + Clone, V: Clone + Send + Sync + 'static> Coalesce<K, V> {
    /// `compute` only runs when no caller is already computing `key` and no fresh result of it is kept.
    pub async fn run(&self, key: K, compute: impl Future<Output = V> + Send + 'static) -> V {
        let fut = {
            let mut s = self.state.lock().unwrap();
            if let Some((at, value)) = s.done.get(&key)
                && at.elapsed() < self.ttl
            {
                return value.clone();
            }
            s.inflight.entry(key.clone()).or_insert_with(|| compute.boxed().shared()).clone()
        };
        let value = fut.clone().await;
        let mut s = self.state.lock().unwrap();
        if s.inflight.get(&key).is_some_and(|f| f.ptr_eq(&fut)) {
            s.inflight.remove(&key);
            if !self.ttl.is_zero() {
                s.done.retain(|_, (at, _)| at.elapsed() < self.ttl);
                s.done.insert(key, (Instant::now(), value.clone()));
            }
        }
        value
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[tokio::test]
    async fn concurrent_callers_share_one_computation_and_later_ones_recompute() {
        let c = Coalesce::<&str, usize>::default();
        let runs = Arc::new(AtomicUsize::new(0));
        let compute = |runs: Arc<AtomicUsize>| async move {
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
            runs.fetch_add(1, Ordering::SeqCst) + 1
        };
        let (a, b) = tokio::join!(c.run("w", compute(runs.clone())), c.run("w", compute(runs.clone())));
        assert_eq!((a, b), (1, 1));
        assert_eq!(c.run("other", compute(runs.clone())).await, 2);
        assert_eq!(c.run("w", compute(runs.clone())).await, 3);
    }

    #[tokio::test(start_paused = true)]
    async fn results_answer_the_same_key_until_they_expire() {
        let c = Coalesce::<&str, usize>::with_ttl(Duration::from_millis(1500));
        let runs = Arc::new(AtomicUsize::new(0));
        let compute = |runs: Arc<AtomicUsize>| async move { runs.fetch_add(1, Ordering::SeqCst) + 1 };
        assert_eq!(c.run("w", compute(runs.clone())).await, 1);
        tokio::time::advance(Duration::from_millis(1400)).await;
        assert_eq!(c.run("w", compute(runs.clone())).await, 1);
        assert_eq!(c.run("other", compute(runs.clone())).await, 2);
        tokio::time::advance(Duration::from_millis(200)).await;
        assert_eq!(c.run("w", compute(runs.clone())).await, 3);
        assert_eq!(c.run("w", compute(runs.clone())).await, 3);
    }
}
