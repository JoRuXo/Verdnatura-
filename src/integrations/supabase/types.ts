export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      articulos: {
        Row: {
          cajas: number
          created_at: string
          descripcion: string | null
          fecha: string | null
          id: string
          lote: string | null
          nombre: string
          proveedor: string | null
          stock_minimo: number
          categoria: string | null
          unidades_por_caja: number
          updated_at: string
        }
        Insert: {
          cajas?: number
          created_at?: string
          descripcion?: string | null
          fecha?: string | null
          id?: string
          lote?: string | null
          nombre: string
          proveedor?: string | null
          stock_minimo?: number
          categoria?: string | null
          unidades_por_caja?: number
          updated_at?: string
        }
        Update: {
          cajas?: number
          created_at?: string
          descripcion?: string | null
          fecha?: string | null
          id?: string
          lote?: string | null
          nombre?: string
          proveedor?: string | null
          stock_minimo?: number
          categoria?: string | null
          unidades_por_caja?: number
          updated_at?: string
        }
        Relationships: []
      }
      estanterias: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          pasillo: number | null
          posicion: number | null
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          pasillo?: number | null
          posicion?: number | null
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          pasillo?: number | null
          posicion?: number | null
        }
        Relationships: []
      }
      movimientos: {
        Row: {
          articulo_id: string | null
          articulo_nombre: string | null
          cantidad_antes: number | null
          cantidad_despues: number | null
          created_at: string
          descripcion: string
          id: string
          tipo: string
          ubicacion_destino: string | null
          ubicacion_origen: string | null
        }
        Insert: {
          articulo_id?: string | null
          articulo_nombre?: string | null
          cantidad_antes?: number | null
          cantidad_despues?: number | null
          created_at?: string
          descripcion: string
          id?: string
          tipo: string
          ubicacion_destino?: string | null
          ubicacion_origen?: string | null
        }
        Update: {
          articulo_id?: string | null
          articulo_nombre?: string | null
          cantidad_antes?: number | null
          cantidad_despues?: number | null
          created_at?: string
          descripcion?: string
          id?: string
          tipo?: string
          ubicacion_destino?: string | null
          ubicacion_origen?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_articulo_id_fkey"
            columns: ["articulo_id"]
            isOneToOne: false
            referencedRelation: "articulos"
            referencedColumns: ["id"]
          },
        ]
      }
      palets: {
        Row: {
          articulo_id: string | null
          cantidad: number
          created_at: string
          id: string
          slot: number
          ubicacion_id: string
          updated_at: string
        }
        Insert: {
          articulo_id?: string | null
          cantidad?: number
          created_at?: string
          id?: string
          slot: number
          ubicacion_id: string
          updated_at?: string
        }
        Update: {
          articulo_id?: string | null
          cantidad?: number
          created_at?: string
          id?: string
          slot?: number
          ubicacion_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "palets_articulo_id_fkey"
            columns: ["articulo_id"]
            isOneToOne: false
            referencedRelation: "articulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palets_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      ubicaciones: {
        Row: {
          articulo_id: string | null
          cantidad: number
          created_at: string
          estanteria_id: string
          id: string
          nivel: string
          posicion: number
          updated_at: string
        }
        Insert: {
          articulo_id?: string | null
          cantidad?: number
          created_at?: string
          estanteria_id: string
          id?: string
          nivel: string
          posicion: number
          updated_at?: string
        }
        Update: {
          articulo_id?: string | null
          cantidad?: number
          created_at?: string
          estanteria_id?: string
          id?: string
          nivel?: string
          posicion?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ubicaciones_articulo_id_fkey"
            columns: ["articulo_id"]
            isOneToOne: false
            referencedRelation: "articulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ubicaciones_estanteria_id_fkey"
            columns: ["estanteria_id"]
            isOneToOne: false
            referencedRelation: "estanterias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      crear_estanteria_con_ubicaciones: {
        Args: {
          p_descripcion?: string
          p_nombre: string
          p_pasillo?: number
          p_posicion?: number
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
