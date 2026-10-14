import { act, fireEvent, screen } from '@testing-library/react'
import { vi } from 'vitest'

/** jsdom has no canvas or object URLs: stand-ins so `AvatarEditor` can crop. */
export function mockCrop() {
  URL.createObjectURL = vi.fn(() => 'blob:picked')
  URL.revokeObjectURL = vi.fn()
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never
  HTMLCanvasElement.prototype.toBlob = (cb: BlobCallback) => {
    cb(new Blob(['x'], { type: 'image/png' }))
  }
}

export const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'me.png', { type: 'image/png' })

/** Picks `file` with the editor's input inside `scope`, then confirms the crop dialog. */
export async function uploadAvatar(scope: HTMLElement, file = png()) {
  fireEvent.change(scope.querySelector('input[type=file][aria-label="选择图片"]') as HTMLInputElement, {
    target: { files: [file] },
  })
  const img = (await screen.findByRole('dialog', { name: '编辑头像' })).querySelector(
    'img',
  ) as HTMLImageElement
  Object.defineProperty(img, 'naturalWidth', { value: 300 })
  Object.defineProperty(img, 'naturalHeight', { value: 300 })
  fireEvent.load(img)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '完成' })))
}
