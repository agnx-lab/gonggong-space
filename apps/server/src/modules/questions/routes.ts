import { AnswerQuestionsReq, LeanReq } from '@gonggong/protocol'
import type { FastifyInstance } from 'fastify'
import type { Ctx } from '../../context.js'
import { idParam } from '../../lib/ids.js'
import { requireUser } from '../auth/session.js'
import { answerQuestions, toggleLeaning } from './service.js'

export function questionRoutes(ctx: Ctx) {
  return async (app: FastifyInstance) => {
    app.post<{ Params: { runId: string; id: string } }>(
      '/api/runs/:runId/questions/:id/answers',
      async (req) => {
        const user = await requireUser(ctx, req)
        const { answers, attachmentIds } = AnswerQuestionsReq.parse(req.body)
        const runId = idParam(req.params.runId, '运行不存在')
        return answerQuestions(ctx, user, runId, idParam(req.params.id, '提问不存在'), answers, attachmentIds)
      },
    )
    app.post<{ Params: { runId: string; id: string } }>(
      '/api/runs/:runId/questions/:id/leanings',
      async (req) => {
        const user = await requireUser(ctx, req)
        const runId = idParam(req.params.runId, '运行不存在')
        return toggleLeaning(ctx, user, runId, idParam(req.params.id, '提问不存在'), LeanReq.parse(req.body))
      },
    )
  }
}
