import type { MachineDto } from '@gonggong/protocol'

export const OS_LABEL: Record<MachineDto['os'], string> = {
  macos: 'macOS',
  linux: 'Linux',
  windows: 'Windows',
}
