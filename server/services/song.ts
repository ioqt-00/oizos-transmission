import path from "node:path"

export const PORT=3001,ROOT=process.cwd()
export const dataDir=path.join(ROOT,'server','data')
export const uploadDir=path.join(ROOT,'server','uploads')

const RESOURCE_TYPES = ['audio', 'video', 'note', 'link'] as const
type ResourceType = typeof RESOURCE_TYPES[number]

export function isResourceType(value: unknown): value is ResourceType {
  return typeof value === 'string' &&
    RESOURCE_TYPES.includes(value as ResourceType)
}
