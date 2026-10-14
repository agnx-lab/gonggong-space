import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AvatarEditor, cropBox, useToasts } from '../src/ui'
import { mockCrop, png } from './crop'

beforeEach(mockCrop)
afterEach(() => useToasts.setState({ items: [] }))

const pick = (file: File) =>
  fireEvent.change(screen.getByLabelText('选择图片'), { target: { files: [file] } })

function loaded(w: number, h: number) {
  const img = document.querySelector('.ui-avatar-crop__view img') as HTMLImageElement
  Object.defineProperty(img, 'naturalWidth', { value: w })
  Object.defineProperty(img, 'naturalHeight', { value: h })
  fireEvent.load(img)
  return img
}

describe('cropBox', () => {
  it('covers the viewport and keeps the image over it', () => {
    expect(cropBox({ w: 400, h: 200 }, { zoom: 1, x: 0, y: 0 }, 100)).toEqual({
      left: -50,
      top: 0,
      width: 200,
      height: 100,
      x: 0,
      y: 0,
    })
    expect(cropBox({ w: 400, h: 200 }, { zoom: 1, x: 500, y: 30 }, 100)).toMatchObject({
      left: 0,
      top: 0,
      x: 50,
      y: 0,
    })
    expect(cropBox({ w: 100, h: 100 }, { zoom: 2, x: -500, y: 0 }, 100)).toMatchObject({
      left: -100,
      width: 200,
    })
  })
})

describe('AvatarEditor', () => {
  it('crops a picked image and uploads the result', async () => {
    const onUpload = vi.fn(async () => {})
    render(<AvatarEditor name="王磊" onUpload={onUpload} />)
    pick(png())
    expect(screen.getByRole('dialog', { name: '编辑头像' })).toBeTruthy()
    const img = loaded(400, 200)
    expect(img.style.width).toBe('480px')
    fireEvent.change(screen.getByLabelText('缩放'), { target: { value: '2' } })
    expect(img.style.width).toBe('960px')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '完成' })))
    expect(onUpload).toHaveBeenCalledWith(expect.any(Blob))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:picked')
  })

  it('refuses files that are not raster images', () => {
    render(<AvatarEditor name="王磊" onUpload={vi.fn()} />)
    pick(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useToasts.getState().items[0]?.message).toBe('头像仅支持 PNG、JPEG、WebP 或 GIF 图片')
  })

  it('keeps the dialog open when the upload fails', async () => {
    render(<AvatarEditor name="王磊" onUpload={() => Promise.reject(new Error('太大了'))} />)
    pick(png())
    loaded(100, 100)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '完成' })))
    expect(screen.getByRole('dialog', { name: '编辑头像' })).toBeTruthy()
    expect(useToasts.getState().items[0]?.message).toBe('太大了')
  })

  it('re-crops an uploaded image and resets to the default', async () => {
    const onRemove = vi.fn(async () => {})
    const { rerender } = render(
      <AvatarEditor name="王磊" src="/api/avatars/a.png" onUpload={vi.fn()} onRemove={onRemove} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '编辑…' }))
    expect(document.querySelector('.ui-avatar-crop__view img')?.getAttribute('src')).toBe(
      '/api/avatars/a.png',
    )
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '恢复默认' })))
    expect(onRemove).toHaveBeenCalled()

    rerender(
      <AvatarEditor name="王磊" src="https://feishu.cn/a.png" onUpload={vi.fn()} onRemove={onRemove} />,
    )
    expect(screen.queryByRole('button', { name: '编辑…' })).toBeNull()
    rerender(<AvatarEditor name="王磊" onUpload={vi.fn()} onRemove={onRemove} />)
    expect(screen.queryByRole('button', { name: '恢复默认' })).toBeNull()
  })
})
