import { json } from '@sveltejs/kit';

export async function GET({ url }) {
  const search = url.searchParams.get('search');
  const country = url.searchParams.get('country') || 'dk';
  
  if (!search || search.trim() === '') {
    return json({ error: 'Search value cannot be empty' }, { status: 400 });
  }

  try {
    const apiUrl = `https://cvrapi.dk/api?search=${encodeURIComponent(search)}&country=${country}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Your App Name/1.0' // Consider using your actual app name here
      }
    });
    
    if (!response.ok) {
      return json(
        { error: `CVR API request failed with status ${response.status}` }, 
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return json(data);
  } catch (error) {
    console.error('Error fetching CVR data:', error);
    return json({ error: error.message }, { status: 500 });
  }
}