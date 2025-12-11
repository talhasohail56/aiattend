/**
 * Get approximate location name from coordinates
 * This is a simple implementation - in production you might want to use a geocoding service
 */
export async function getLocationName(lat: number | null, lng: number | null): Promise<string> {
  if (!lat || !lng) {
    return 'Location not shared'
  }

  try {
    // Using a simple reverse geocoding approach
    // In production, you might want to use Google Maps Geocoding API or similar
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    )
    const data = await response.json()
    
    if (data.locality || data.city) {
      return `${data.locality || data.city}, ${data.countryName || ''}`
    }
    
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch (error) {
    // Fallback to coordinates
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}

/**
 * Get Google Maps link for coordinates
 */
export function getGoogleMapsLink(lat: number | null, lng: number | null): string | null {
  if (!lat || !lng) {
    return null
  }
  return `https://www.google.com/maps?q=${lat},${lng}`
}


