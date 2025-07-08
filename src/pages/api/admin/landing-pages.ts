import type { APIRoute } from 'astro';
import { dbHelpers } from '../../../lib/database';
import { authHelpers } from '../../../lib/auth';

export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Verificar autenticación
    const authData = authHelpers.requireAuthFromCookies(request);
    if (!authData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const searchParams = url.searchParams;
    const id = searchParams.get('id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    
    // Si se solicita una página específica por ID
    if (id) {
      const landingPage = dbHelpers.getLandingPageById(parseInt(id));
      if (landingPage) {
        const parsedPage = {
          ...landingPage,
          config: landingPage.config ? JSON.parse(landingPage.config) : {}
        };
        return new Response(JSON.stringify({
          success: true,
          pages: [parsedPage]
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: 'Página no encontrada'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    const offset = (page - 1) * limit;

    // Obtener landing pages
    const landingPages = dbHelpers.getLandingPages(limit, offset);
    
    // Aplicar filtros después de obtener los datos (simplificado)
    let filteredPages = landingPages;
    if (status) {
      filteredPages = filteredPages.filter((page: any) => page.status === status);
    }
    
    // Parse config JSON for each page
    const parsedPages = filteredPages.map((page: any) => ({
      ...page,
      config: page.config ? JSON.parse(page.config) : {}
    }));

    // Obtener estadísticas
    const stats = dbHelpers.getLandingPageStats();

    return new Response(JSON.stringify({
      success: true,
      pages: parsedPages,
      stats,
      pagination: {
        page,
        limit,
        total: parsedPages.length,
        totalPages: Math.ceil(parsedPages.length / limit),
        hasNext: page * limit < parsedPages.length,
        hasPrev: page > 1
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error obteniendo landing pages:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verificar autenticación
    const authData = authHelpers.requireAuthFromCookies(request);
    if (!authData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { 
      name, slug, type, status, description, metaTitle, metaDescription, 
      template, conversionGoal, trackingCode 
    } = body;

    // Validaciones básicas
    if (!name || !slug) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Nombre y slug son obligatorios'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que el slug no exista
    const existingPage = dbHelpers.getLandingPageBySlug(slug);
    if (existingPage) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Ya existe una página con ese slug'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Preparar configuración
    const config = {
      type: type || 'custom',
      description: description || '',
      conversionGoal: conversionGoal || '',
      trackingCode: trackingCode || '',
      components: []
    };

    // Preparar datos para insertar
    const pageData = {
      name: name.trim(),
      slug: slug.trim(),
      template: template || 'clean',
      config,
      status: status || 'draft',
      seoTitle: metaTitle?.trim() || '',
      seoDescription: metaDescription?.trim() || ''
    };

    console.log('📄 Creando landing page:', pageData);

    // Insertar en base de datos
    const result = dbHelpers.insertLandingPage(pageData);

    if (result.lastInsertRowid) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Landing page creada correctamente',
        id: result.lastInsertRowid
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error('Error insertando landing page en base de datos');
    }

  } catch (error) {
    console.error('Error creando landing page:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    // Verificar autenticación
    const authData = authHelpers.requireAuthFromCookies(request);
    if (!authData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { 
      id, name, slug, type, status, description, metaTitle, metaDescription, 
      template, conversionGoal, trackingCode 
    } = body;

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID es obligatorio'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que la página existe
    const existingPage = dbHelpers.getLandingPageById(id);
    if (!existingPage) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Landing page no encontrada'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Si se cambió el slug, verificar que no exista otro con el mismo slug
    if (slug && slug !== existingPage.slug) {
      const duplicatePage = dbHelpers.getLandingPageBySlug(slug);
      if (duplicatePage && duplicatePage.id !== id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Ya existe una página con ese slug'
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Preparar configuración actualizada
    const existingConfig = existingPage.config ? JSON.parse(existingPage.config) : {};
    const config = {
      ...existingConfig,
      type: type || existingConfig.type || 'custom',
      description: description || existingConfig.description || '',
      conversionGoal: conversionGoal || existingConfig.conversionGoal || '',
      trackingCode: trackingCode || existingConfig.trackingCode || ''
    };

    // Preparar datos para actualizar
    const pageData = {
      name: name?.trim() || existingPage.name,
      slug: slug?.trim() || existingPage.slug,
      template: template || existingPage.template,
      config,
      status: status || existingPage.status,
      seoTitle: metaTitle?.trim() || existingPage.seo_title || '',
      seoDescription: metaDescription?.trim() || existingPage.seo_description || ''
    };

    console.log('📄 Actualizando landing page:', pageData);

    // Actualizar en base de datos
    const result = dbHelpers.updateLandingPage(id, pageData);

    if (result.changes > 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Landing page actualizada correctamente'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'No se pudo actualizar la landing page'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error actualizando landing page:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    // Verificar autenticación
    const authData = authHelpers.requireAuthFromCookies(request);
    if (!authData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID es obligatorio'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que la página existe
    const existingPage = dbHelpers.getLandingPageById(id);
    if (!existingPage) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Landing page no encontrada'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('🗑️ Eliminando landing page:', id);

    // Eliminar de base de datos
    const result = dbHelpers.deleteLandingPage(id);

    if (result.changes > 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Landing page eliminada correctamente'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'No se pudo eliminar la landing page'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error eliminando landing page:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};