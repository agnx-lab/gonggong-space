import type { BotDto, ProgressCard as Card } from '@gonggong/protocol'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkspace } from '../src/app/workspace'
import { ProgressCard } from '../src/features/chat/ProgressCard'

const card = (o: Partial<Card> = {}): Card => ({
  id: 'm1',
  botId: 'b1',
  title: '部署 luke-server 到 test',
  stages: [
    { name: '排队', status: 'done' },
    { name: '构建', status: 'running' },
    { name: '部署', status: 'pending' },
  ],
  percent: 40,
  detail: '构建号 #128',
  link: null,
  status: 'running',
  updatedAt: '2026-10-20T02:00:00Z',
  ...o,
})

beforeEach(() => {
  useWorkspace.setState({ bots: [{ id: 'b1', name: '部署 Bot', avatar: 'role-no' } as BotDto] })
})

describe('ProgressCard', () => {
  it('shows the title, each stage with its state, the percent and detail', () => {
    render(<ProgressCard card={card()} />)
    const el = screen.getByTestId('progress-card')
    expect(el.getAttribute('data-status')).toBe('running')
    expect(el.textContent).toContain('部署 luke-server 到 test')
    expect(el.textContent).toContain('部署 Bot')
    expect(el.textContent).toContain('进行中')
    const stages = screen.getAllByTestId('progress-stage')
    expect(stages.map((s) => [s.textContent, s.getAttribute('data-status')])).toEqual([
      ['排队', 'done'],
      ['构建', 'running'],
      ['部署', 'pending'],
    ])
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40')
    expect(el.textContent).toContain('构建号 #128')
  })

  it('marks a settled card and offers its link', () => {
    render(
      <ProgressCard
        card={card({
          status: 'failed',
          percent: null,
          stages: [{ name: '部署', status: 'failed' }],
          detail: '健康检查失败',
          link: { label: '构建日志', url: 'https://ci.example.com/128' },
        })}
      />,
    )
    expect(screen.getByTestId('progress-card').textContent).toContain('失败')
    expect(screen.queryByRole('progressbar')).toBeNull()
    const link = screen.getByRole('link', { name: '构建日志' })
    expect(link.getAttribute('href')).toBe('https://ci.example.com/128')
    expect(link.getAttribute('target')).toBe('_blank')
  })
})
