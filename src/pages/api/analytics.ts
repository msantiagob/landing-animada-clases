import type { APIRoute } from 'astro';
import { dbHelpers } from '../../lib/database';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { eventType, pageUrl, referrer, metadata = {} } = body;

    // Get additional request information
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Generate a simple session ID based on IP and User Agent
    const sessionId = btoa(`${ip}-${userAgent}`).slice(0, 16);

    // Prepare analytics data
    const analyticsData = {
      eventType: eventType || 'page_view',
      pageUrl: pageUrl || '/',
      referrer: referrer || 'direct',
      userAgent,
      ipAddress: ip,
      sessionId,
      metadata
    };

    console.log('📊 Analytics event:', analyticsData);

    // Insert into database
    const result = dbHelpers.insertAnalytics(analyticsData);

    if (result.lastInsertRowid) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Analytics event recorded'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error('Error inserting analytics data');
    }

  } catch (error) {
    console.error('Error recording analytics:', error);
    
    // Don't fail the request for analytics errors
    return new Response(JSON.stringify({
      success: false,
      error: 'Analytics recording failed'
    }), {
      status: 200, // Return 200 so the page doesn't break
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = url.searchParams;
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('endDate') || new Date().toISOString();
    const eventType = searchParams.get('eventType');

    // Get analytics data
    const analytics = dbHelpers.getAnalytics(startDate, endDate, eventType);

    return new Response(JSON.stringify({
      success: true,
      data: analytics,
      summary: {
        totalEvents: analytics.length,
        uniqueSessions: [...new Set(analytics.map((a: any) => a.session_id))].length,
        dateRange: { startDate, endDate }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting analytics:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error retrieving analytics data'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};