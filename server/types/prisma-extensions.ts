// Extensiones temporales para tipos de Prisma hasta que se regenere el cliente

declare module "@prisma/client" {
  interface PuntoAtencion {
    servientrega_agencia_codigo?: string | null;
    servientrega_agencia_nombre?: string | null;
  }
}
