import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

interface ServientregaCredentials {
  usuingreso: string;
  contrasenha: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔐 Solicitando credenciales de Servientrega...');

    // Obtener credenciales de los secrets de Supabase
    const usuingreso = Deno.env.get('SERVIENTREGA_USER');
    const contrasenha = Deno.env.get('SERVIENTREGA_PASSWORD');

    if (!usuingreso || !contrasenha) {
      console.error('❌ Credenciales de Servientrega no configuradas');
      return new Response(
        JSON.stringify({ 
          error: 'Credenciales de Servientrega no configuradas',
          details: 'SERVIENTREGA_USER y SERVIENTREGA_PASSWORD deben estar configurados en los secrets'
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const credentials: ServientregaCredentials = {
      usuingreso,
      contrasenha
    };

    console.log('✅ Credenciales obtenidas correctamente');

    return new Response(
      JSON.stringify({ 
        success: true, 
        credentials 
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error al obtener credenciales:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});