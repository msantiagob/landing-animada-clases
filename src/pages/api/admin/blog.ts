import type { APIRoute } from 'astro';
import { authHelpers } from '../../../lib/auth';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const postsDirectory = path.join(process.cwd(), 'src', 'data', 'post');

// GET - Obtener post específico o todos los posts
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
    const filename = searchParams.get('filename');

    if (filename) {
      // Obtener post específico
      const filePath = path.join(postsDirectory, filename);
      
      if (!fs.existsSync(filePath)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Post no encontrado'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(fileContent);
      
      return new Response(JSON.stringify({
        success: true,
        post: {
          filename,
          slug: filename.replace(/\.(md|mdx)$/, ''),
          ...data,
          content,
          lastModified: fs.statSync(filePath).mtime
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener todos los posts
    const filenames = fs.readdirSync(postsDirectory);
    const posts = filenames
      .filter(name => name.endsWith('.md') || name.endsWith('.mdx'))
      .map(filename => {
        const filePath = path.join(postsDirectory, filename);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const { data, content } = matter(fileContent);
        
        return {
          filename,
          slug: filename.replace(/\.(md|mdx)$/, ''),
          ...data,
          content,
          publishDate: data.publishDate || new Date(),
          lastModified: fs.statSync(filePath).mtime
        };
      })
      .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());

    return new Response(JSON.stringify({
      success: true,
      posts
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error obteniendo posts:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST - Crear nuevo post
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
    const { title, slug, category, excerpt, image, tags, content, publishDate, metaTitle, metaDescription, canonical, author } = body;

    if (!title || !slug || !content) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Título, slug y contenido son obligatorios'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generar nombre de archivo
    const filename = `${slug}.md`;
    const filePath = path.join(postsDirectory, filename);

    // Verificar si el archivo ya existe
    if (fs.existsSync(filePath)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Ya existe un post con este slug'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Crear frontmatter
    const frontmatter = {
      publishDate: publishDate || new Date().toISOString(),
      title,
      ...(excerpt && { excerpt }),
      ...(image && { image }),
      ...(category && { category }),
      ...(tags && tags.length > 0 && { tags }),
      ...(author && { author }),
      ...(metaTitle || metaDescription || canonical ? {
        metadata: {
          ...(metaTitle && { title: metaTitle }),
          ...(metaDescription && { description: metaDescription }),
          ...(canonical && { canonical })
        }
      } : {})
    };

    // Crear contenido del archivo
    const fileContent = matter.stringify(content, frontmatter);

    // Crear directorio si no existe
    if (!fs.existsSync(postsDirectory)) {
      fs.mkdirSync(postsDirectory, { recursive: true });
    }

    // Escribir archivo
    fs.writeFileSync(filePath, fileContent, 'utf8');

    return new Response(JSON.stringify({
      success: true,
      message: 'Post creado correctamente',
      filename
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creando post:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PUT - Actualizar post existente
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
    const { filename, title, slug, category, excerpt, image, tags, content, publishDate, metaTitle, metaDescription, canonical, author } = body;

    if (!filename || !title || !slug || !content) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Filename, título, slug y contenido son obligatorios'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const filePath = path.join(postsDirectory, filename);

    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Si el slug cambió, renombrar archivo
    const newFilename = `${slug}.md`;
    const newFilePath = path.join(postsDirectory, newFilename);

    if (filename !== newFilename && fs.existsSync(newFilePath)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Ya existe un post con este slug'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Crear frontmatter
    const frontmatter = {
      publishDate: publishDate || new Date().toISOString(),
      title,
      ...(excerpt && { excerpt }),
      ...(image && { image }),
      ...(category && { category }),
      ...(tags && tags.length > 0 && { tags }),
      ...(author && { author }),
      ...(metaTitle || metaDescription || canonical ? {
        metadata: {
          ...(metaTitle && { title: metaTitle }),
          ...(metaDescription && { description: metaDescription }),
          ...(canonical && { canonical })
        }
      } : {})
    };

    // Crear contenido del archivo
    const fileContent = matter.stringify(content, frontmatter);

    // Escribir archivo
    fs.writeFileSync(newFilePath, fileContent, 'utf8');

    // Si el nombre cambió, eliminar el archivo anterior
    if (filename !== newFilename) {
      fs.unlinkSync(filePath);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Post actualizado correctamente',
      filename: newFilename
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error actualizando post:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE - Eliminar post
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
    const { filename } = body;

    if (!filename) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Filename es obligatorio'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const filePath = path.join(postsDirectory, filename);

    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Eliminar archivo
    fs.unlinkSync(filePath);

    return new Response(JSON.stringify({
      success: true,
      message: 'Post eliminado correctamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error eliminando post:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};