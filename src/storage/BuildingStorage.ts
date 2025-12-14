import type { BuildingData, BuildingSummary } from './BuildingTypes'

const API_BASE = '/api/buildings'

/**
 * Client-side API for saving and loading buildings.
 */
export class BuildingStorage {
  /**
   * List all saved buildings.
   */
  static async list(): Promise<BuildingSummary[]> {
    const response = await fetch(API_BASE)
    if (!response.ok) {
      throw new Error(`Failed to list buildings: ${response.statusText}`)
    }
    return response.json()
  }

  /**
   * Load a building by name.
   */
  static async load(name: string): Promise<BuildingData> {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(name)}`)
    if (!response.ok) {
      throw new Error(`Failed to load building: ${response.statusText}`)
    }
    return response.json()
  }

  /**
   * Save a building (creates or overwrites).
   */
  static async save(data: BuildingData): Promise<void> {
    const url = `${API_BASE}/${encodeURIComponent(data.name)}`
    console.log(`[BuildingStorage] PUT ${url}`)
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2)
    })
    if (!response.ok) {
      throw new Error(`PUT ${url} failed: ${response.status} ${response.statusText}`)
    }
  }

  /**
   * Delete a building by name.
   */
  static async delete(name: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      throw new Error(`Failed to delete building: ${response.statusText}`)
    }
  }
}
