import { Icon, type IconName, Spinner, Tooltip } from '../../../ui'

/** A compact icon button of the log's toolbars; `pressed` makes it a toggle. */
export function Tool({
  icon,
  label,
  pressed,
  busy,
  disabled,
  onClick,
}: {
  icon: IconName
  label: string
  pressed?: boolean
  busy?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        className="glog-tool"
        aria-label={label}
        aria-pressed={pressed}
        disabled={busy || disabled}
        onClick={onClick}
      >
        {busy ? <Spinner size={12} /> : <Icon name={icon} size={14} />}
      </button>
    </Tooltip>
  )
}
