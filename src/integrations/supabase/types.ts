export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      CambioDivisa: {
        Row: {
          estado: Database["public"]["Enums"]["EstadoTransaccion"]
          fecha: string
          id: string
          moneda_destino_id: string
          moneda_origen_id: string
          monto_destino: number
          monto_origen: number
          numero_recibo: string | null
          observacion: string | null
          punto_atencion_id: string
          tasa_cambio: number
          tipo_operacion: Database["public"]["Enums"]["TipoOperacion"]
          usuario_id: string
        }
        Insert: {
          estado?: Database["public"]["Enums"]["EstadoTransaccion"]
          fecha?: string
          id?: string
          moneda_destino_id: string
          moneda_origen_id: string
          monto_destino: number
          monto_origen: number
          numero_recibo?: string | null
          observacion?: string | null
          punto_atencion_id: string
          tasa_cambio: number
          tipo_operacion: Database["public"]["Enums"]["TipoOperacion"]
          usuario_id: string
        }
        Update: {
          estado?: Database["public"]["Enums"]["EstadoTransaccion"]
          fecha?: string
          id?: string
          moneda_destino_id?: string
          moneda_origen_id?: string
          monto_destino?: number
          monto_origen?: number
          numero_recibo?: string | null
          observacion?: string | null
          punto_atencion_id?: string
          tasa_cambio?: number
          tipo_operacion?: Database["public"]["Enums"]["TipoOperacion"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "CambioDivisa_moneda_destino_id_fkey"
            columns: ["moneda_destino_id"]
            isOneToOne: false
            referencedRelation: "Moneda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CambioDivisa_moneda_origen_id_fkey"
            columns: ["moneda_origen_id"]
            isOneToOne: false
            referencedRelation: "Moneda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CambioDivisa_punto_atencion_id_fkey"
            columns: ["punto_atencion_id"]
            isOneToOne: false
            referencedRelation: "PuntoAtencion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CambioDivisa_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      CuadreCaja: {
        Row: {
          estado: Database["public"]["Enums"]["EstadoCierre"]
          fecha: string
          fecha_cierre: string | null
          id: string
          observaciones: string | null
          punto_atencion_id: string
          total_cambios: number
          total_transferencias_entrada: number
          total_transferencias_salida: number
          usuario_id: string
        }
        Insert: {
          estado?: Database["public"]["Enums"]["EstadoCierre"]
          fecha?: string
          fecha_cierre?: string | null
          id?: string
          observaciones?: string | null
          punto_atencion_id: string
          total_cambios?: number
          total_transferencias_entrada?: number
          total_transferencias_salida?: number
          usuario_id: string
        }
        Update: {
          estado?: Database["public"]["Enums"]["EstadoCierre"]
          fecha?: string
          fecha_cierre?: string | null
          id?: string
          observaciones?: string | null
          punto_atencion_id?: string
          total_cambios?: number
          total_transferencias_entrada?: number
          total_transferencias_salida?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "CuadreCaja_punto_atencion_id_fkey"
            columns: ["punto_atencion_id"]
            isOneToOne: false
            referencedRelation: "PuntoAtencion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CuadreCaja_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      DetalleCuadreCaja: {
        Row: {
          billetes: number
          conteo_fisico: number
          cuadre_id: string
          diferencia: number
          id: string
          moneda_id: string
          monedas_fisicas: number
          saldo_apertura: number
          saldo_cierre: number
        }
        Insert: {
          billetes?: number
          conteo_fisico: number
          cuadre_id: string
          diferencia?: number
          id?: string
          moneda_id: string
          monedas_fisicas?: number
          saldo_apertura: number
          saldo_cierre: number
        }
        Update: {
          billetes?: number
          conteo_fisico?: number
          cuadre_id?: string
          diferencia?: number
          id?: string
          moneda_id?: string
          monedas_fisicas?: number
          saldo_apertura?: number
          saldo_cierre?: number
        }
        Relationships: [
          {
            foreignKeyName: "DetalleCuadreCaja_cuadre_id_fkey"
            columns: ["cuadre_id"]
            isOneToOne: false
            referencedRelation: "CuadreCaja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "DetalleCuadreCaja_moneda_id_fkey"
            columns: ["moneda_id"]
            isOneToOne: false
            referencedRelation: "Moneda"
            referencedColumns: ["id"]
          },
        ]
      }
      HistorialSaldo: {
        Row: {
          cantidad_anterior: number
          cantidad_incrementada: number
          cantidad_nueva: number
          descripcion: string | null
          fecha: string
          id: string
          moneda_id: string
          numero_referencia: string | null
          punto_atencion_id: string
          tipo_movimiento: Database["public"]["Enums"]["TipoMovimiento"]
          usuario_id: string
        }
        Insert: {
          cantidad_anterior: number
          cantidad_incrementada: number
          cantidad_nueva: number
          descripcion?: string | null
          fecha?: string
          id?: string
          moneda_id: string
          numero_referencia?: string | null
          punto_atencion_id: string
          tipo_movimiento: Database["public"]["Enums"]["TipoMovimiento"]
          usuario_id: string
        }
        Update: {
          cantidad_anterior?: number
          cantidad_incrementada?: number
          cantidad_nueva?: number
          descripcion?: string | null
          fecha?: string
          id?: string
          moneda_id?: string
          numero_referencia?: string | null
          punto_atencion_id?: string
          tipo_movimiento?: Database["public"]["Enums"]["TipoMovimiento"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "HistorialSaldo_moneda_id_fkey"
            columns: ["moneda_id"]
            isOneToOne: false
            referencedRelation: "Moneda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "HistorialSaldo_punto_atencion_id_fkey"
            columns: ["punto_atencion_id"]
            isOneToOne: false
            referencedRelation: "PuntoAtencion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "HistorialSaldo_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      Jornada: {
        Row: {
          estado: string | null
          fecha_almuerzo: string | null
          fecha_inicio: string
          fecha_regreso: string | null
          fecha_salida: string | null
          id: string
          punto_atencion_id: string
          ubicacion_inicio: Json | null
          ubicacion_salida: Json | null
          usuario_id: string
        }
        Insert: {
          estado?: string | null
          fecha_almuerzo?: string | null
          fecha_inicio?: string
          fecha_regreso?: string | null
          fecha_salida?: string | null
          id?: string
          punto_atencion_id: string
          ubicacion_inicio?: Json | null
          ubicacion_salida?: Json | null
          usuario_id: string
        }
        Update: {
          estado?: string | null
          fecha_almuerzo?: string | null
          fecha_inicio?: string
          fecha_regreso?: string | null
          fecha_salida?: string | null
          id?: string
          punto_atencion_id?: string
          ubicacion_inicio?: Json | null
          ubicacion_salida?: Json | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Jornada_punto_atencion_id_fkey"
            columns: ["punto_atencion_id"]
            isOneToOne: false
            referencedRelation: "PuntoAtencion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Jornada_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      Moneda: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          id: string
          nombre: string
          orden_display: number
          simbolo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          id?: string
          nombre: string
          orden_display?: number
          simbolo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          nombre?: string
          orden_display?: number
          simbolo?: string
          updated_at?: string
        }
        Relationships: []
      }
      Movimiento: {
        Row: {
          descripcion: string | null
          fecha: string
          id: string
          moneda_id: string
          monto: number
          numero_recibo: string | null
          punto_atencion_id: string
          tipo: Database["public"]["Enums"]["TipoMovimiento"]
          usuario_id: string
        }
        Insert: {
          descripcion?: string | null
          fecha?: string
          id?: string
          moneda_id: string
          monto: number
          numero_recibo?: string | null
          punto_atencion_id: string
          tipo: Database["public"]["Enums"]["TipoMovimiento"]
          usuario_id: string
        }
        Update: {
          descripcion?: string | null
          fecha?: string
          id?: string
          moneda_id?: string
          monto?: number
          numero_recibo?: string | null
          punto_atencion_id?: string
          tipo?: Database["public"]["Enums"]["TipoMovimiento"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Movimiento_moneda_id_fkey"
            columns: ["moneda_id"]
            isOneToOne: false
            referencedRelation: "Moneda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Movimiento_punto_atencion_id_fkey"
            columns: ["punto_atencion_id"]
            isOneToOne: false
            referencedRelation: "PuntoAtencion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Movimiento_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      PuntoAtencion: {
        Row: {
          activo: boolean
          ciudad: string
          codigo_postal: string | null
          created_at: string
          direccion: string
          id: string
          nombre: string
          provincia: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          ciudad: string
          codigo_postal?: string | null
          created_at?: string
          direccion: string
          id?: string
          nombre: string
          provincia: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          ciudad?: string
          codigo_postal?: string | null
          created_at?: string
          direccion?: string
          id?: string
          nombre?: string
          provincia?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      Recibo: {
        Row: {
          datos_operacion: Json
          fecha: string
          id: string
          impreso: boolean
          numero_copias: number
          numero_recibo: string
          punto_atencion_id: string
          referencia_id: string
          tipo_operacion: Database["public"]["Enums"]["TipoRecibo"]
          usuario_id: string
        }
        Insert: {
          datos_operacion: Json
          fecha?: string
          id?: string
          impreso?: boolean
          numero_copias?: number
          numero_recibo: string
          punto_atencion_id: string
          referencia_id: string
          tipo_operacion: Database["public"]["Enums"]["TipoRecibo"]
          usuario_id: string
        }
        Update: {
          datos_operacion?: Json
          fecha?: string
          id?: string
          impreso?: boolean
          numero_copias?: number
          numero_recibo?: string
          punto_atencion_id?: string
          referencia_id?: string
          tipo_operacion?: Database["public"]["Enums"]["TipoRecibo"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Recibo_punto_atencion_id_fkey"
            columns: ["punto_atencion_id"]
            isOneToOne: false
            referencedRelation: "PuntoAtencion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Recibo_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      Saldo: {
        Row: {
          billetes: number
          cantidad: number
          id: string
          moneda_id: string
          monedas_fisicas: number
          punto_atencion_id: string
          updated_at: string
        }
        Insert: {
          billetes?: number
          cantidad?: number
          id?: string
          moneda_id: string
          monedas_fisicas?: number
          punto_atencion_id: string
          updated_at?: string
        }
        Update: {
          billetes?: number
          cantidad?: number
          id?: string
          moneda_id?: string
          monedas_fisicas?: number
          punto_atencion_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Saldo_moneda_id_fkey"
            columns: ["moneda_id"]
            isOneToOne: false
            referencedRelation: "Moneda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Saldo_punto_atencion_id_fkey"
            columns: ["punto_atencion_id"]
            isOneToOne: false
            referencedRelation: "PuntoAtencion"
            referencedColumns: ["id"]
          },
        ]
      }
      SalidaEspontanea: {
        Row: {
          aprobado_por: string | null
          created_at: string
          descripcion: string | null
          duracion_minutos: number | null
          estado: string
          fecha_regreso: string | null
          fecha_salida: string
          id: string
          motivo: string
          punto_atencion_id: string
          ubicacion_regreso: Json | null
          ubicacion_salida: Json | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          aprobado_por?: string | null
          created_at?: string
          descripcion?: string | null
          duracion_minutos?: number | null
          estado?: string
          fecha_regreso?: string | null
          fecha_salida?: string
          id?: string
          motivo: string
          punto_atencion_id: string
          ubicacion_regreso?: Json | null
          ubicacion_salida?: Json | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          aprobado_por?: string | null
          created_at?: string
          descripcion?: string | null
          duracion_minutos?: number | null
          estado?: string
          fecha_regreso?: string | null
          fecha_salida?: string
          id?: string
          motivo?: string
          punto_atencion_id?: string
          ubicacion_regreso?: Json | null
          ubicacion_salida?: Json | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      SolicitudSaldo: {
        Row: {
          aprobado: boolean
          fecha_respuesta: string | null
          fecha_solicitud: string
          id: string
          moneda_id: string
          monto_solicitado: number
          observaciones: string | null
          punto_atencion_id: string
          usuario_id: string
        }
        Insert: {
          aprobado?: boolean
          fecha_respuesta?: string | null
          fecha_solicitud?: string
          id?: string
          moneda_id: string
          monto_solicitado: number
          observaciones?: string | null
          punto_atencion_id: string
          usuario_id: string
        }
        Update: {
          aprobado?: boolean
          fecha_respuesta?: string | null
          fecha_solicitud?: string
          id?: string
          moneda_id?: string
          monto_solicitado?: number
          observaciones?: string | null
          punto_atencion_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "SolicitudSaldo_moneda_id_fkey"
            columns: ["moneda_id"]
            isOneToOne: false
            referencedRelation: "Moneda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "SolicitudSaldo_punto_atencion_id_fkey"
            columns: ["punto_atencion_id"]
            isOneToOne: false
            referencedRelation: "PuntoAtencion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "SolicitudSaldo_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      Transferencia: {
        Row: {
          aprobado_por: string | null
          descripcion: string | null
          destino_id: string
          estado: Database["public"]["Enums"]["EstadoTransferencia"]
          fecha: string
          fecha_aprobacion: string | null
          id: string
          moneda_id: string
          monto: number
          numero_recibo: string | null
          origen_id: string | null
          solicitado_por: string
          tipo_transferencia: Database["public"]["Enums"]["TipoTransferencia"]
        }
        Insert: {
          aprobado_por?: string | null
          descripcion?: string | null
          destino_id: string
          estado?: Database["public"]["Enums"]["EstadoTransferencia"]
          fecha?: string
          fecha_aprobacion?: string | null
          id?: string
          moneda_id: string
          monto: number
          numero_recibo?: string | null
          origen_id?: string | null
          solicitado_por: string
          tipo_transferencia: Database["public"]["Enums"]["TipoTransferencia"]
        }
        Update: {
          aprobado_por?: string | null
          descripcion?: string | null
          destino_id?: string
          estado?: Database["public"]["Enums"]["EstadoTransferencia"]
          fecha?: string
          fecha_aprobacion?: string | null
          id?: string
          moneda_id?: string
          monto?: number
          numero_recibo?: string | null
          origen_id?: string | null
          solicitado_por?: string
          tipo_transferencia?: Database["public"]["Enums"]["TipoTransferencia"]
        }
        Relationships: [
          {
            foreignKeyName: "Transferencia_aprobado_por_fkey"
            columns: ["aprobado_por"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Transferencia_destino_id_fkey"
            columns: ["destino_id"]
            isOneToOne: false
            referencedRelation: "PuntoAtencion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Transferencia_moneda_id_fkey"
            columns: ["moneda_id"]
            isOneToOne: false
            referencedRelation: "Moneda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Transferencia_origen_id_fkey"
            columns: ["origen_id"]
            isOneToOne: false
            referencedRelation: "PuntoAtencion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Transferencia_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "Usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      Usuario: {
        Row: {
          activo: boolean
          correo: string | null
          created_at: string
          id: string
          nombre: string
          password: string
          punto_atencion_id: string | null
          rol: Database["public"]["Enums"]["RolUsuario"]
          telefono: string | null
          updated_at: string
          username: string
        }
        Insert: {
          activo?: boolean
          correo?: string | null
          created_at?: string
          id?: string
          nombre: string
          password: string
          punto_atencion_id?: string | null
          rol: Database["public"]["Enums"]["RolUsuario"]
          telefono?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          activo?: boolean
          correo?: string | null
          created_at?: string
          id?: string
          nombre?: string
          password?: string
          punto_atencion_id?: string | null
          rol?: Database["public"]["Enums"]["RolUsuario"]
          telefono?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "Usuario_punto_atencion_id_fkey"
            columns: ["punto_atencion_id"]
            isOneToOne: false
            referencedRelation: "PuntoAtencion"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      EstadoCierre: "ABIERTO" | "CERRADO"
      EstadoTransaccion: "COMPLETADO" | "PENDIENTE" | "CANCELADO"
      EstadoTransferencia: "PENDIENTE" | "APROBADO" | "RECHAZADO"
      RolUsuario: "SUPER_USUARIO" | "ADMIN" | "OPERADOR" | "CONCESION"
      TipoMovimiento:
        | "INGRESO"
        | "EGRESO"
        | "TRANSFERENCIA_ENTRANTE"
        | "TRANSFERENCIA_SALIENTE"
        | "CAMBIO_DIVISA"
      TipoOperacion: "COMPRA" | "VENTA"
      TipoRecibo:
        | "CAMBIO_DIVISA"
        | "TRANSFERENCIA"
        | "MOVIMIENTO"
        | "DEPOSITO"
        | "RETIRO"
      TipoTransferencia:
        | "ENTRE_PUNTOS"
        | "DEPOSITO_MATRIZ"
        | "RETIRO_GERENCIA"
        | "DEPOSITO_GERENCIA"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      EstadoCierre: ["ABIERTO", "CERRADO"],
      EstadoTransaccion: ["COMPLETADO", "PENDIENTE", "CANCELADO"],
      EstadoTransferencia: ["PENDIENTE", "APROBADO", "RECHAZADO"],
      RolUsuario: ["SUPER_USUARIO", "ADMIN", "OPERADOR", "CONCESION"],
      TipoMovimiento: [
        "INGRESO",
        "EGRESO",
        "TRANSFERENCIA_ENTRANTE",
        "TRANSFERENCIA_SALIENTE",
        "CAMBIO_DIVISA",
      ],
      TipoOperacion: ["COMPRA", "VENTA"],
      TipoRecibo: [
        "CAMBIO_DIVISA",
        "TRANSFERENCIA",
        "MOVIMIENTO",
        "DEPOSITO",
        "RETIRO",
      ],
      TipoTransferencia: [
        "ENTRE_PUNTOS",
        "DEPOSITO_MATRIZ",
        "RETIRO_GERENCIA",
        "DEPOSITO_GERENCIA",
      ],
    },
  },
} as const
