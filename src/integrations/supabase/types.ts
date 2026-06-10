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
      arquivo_logs: {
        Row: {
          acao: Database["public"]["Enums"]["arquivo_acao"]
          arquivo_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          usuario_id: string | null
        }
        Insert: {
          acao: Database["public"]["Enums"]["arquivo_acao"]
          arquivo_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          usuario_id?: string | null
        }
        Update: {
          acao?: Database["public"]["Enums"]["arquivo_acao"]
          arquivo_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arquivo_logs_arquivo_id_fkey"
            columns: ["arquivo_id"]
            isOneToOne: false
            referencedRelation: "arquivos"
            referencedColumns: ["id"]
          },
        ]
      }
      arquivos: {
        Row: {
          bucket: string
          categoria: Database["public"]["Enums"]["arquivo_categoria"]
          created_at: string
          id: string
          medium_path: string | null
          metadata: Json
          mime_type: string | null
          nome: string
          publico: boolean
          registro_id: string | null
          registro_tipo: string | null
          storage_path: string
          tamanho: number
          thumb_path: string | null
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          bucket: string
          categoria?: Database["public"]["Enums"]["arquivo_categoria"]
          created_at?: string
          id?: string
          medium_path?: string | null
          metadata?: Json
          mime_type?: string | null
          nome: string
          publico?: boolean
          registro_id?: string | null
          registro_tipo?: string | null
          storage_path: string
          tamanho?: number
          thumb_path?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          bucket?: string
          categoria?: Database["public"]["Enums"]["arquivo_categoria"]
          created_at?: string
          id?: string
          medium_path?: string | null
          metadata?: Json
          mime_type?: string | null
          nome?: string
          publico?: boolean
          registro_id?: string | null
          registro_tipo?: string | null
          storage_path?: string
          tamanho?: number
          thumb_path?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      auditoria_acessos: {
        Row: {
          created_at: string
          descricao: string | null
          evento: string
          id: string
          ip: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          evento: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          evento?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      condominios: {
        Row: {
          area_total: number | null
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          codigo_interno: string | null
          complemento: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          estado: string | null
          id: string
          infraestrutura: string[]
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          nome: string
          numero: string | null
          numero_lotes: number | null
          portaria: string | null
          seguranca: string | null
          tipo_condominio: string | null
          updated_at: string
        }
        Insert: {
          area_total?: number | null
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_interno?: string | null
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          estado?: string | null
          id?: string
          infraestrutura?: string[]
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          nome: string
          numero?: string | null
          numero_lotes?: number | null
          portaria?: string | null
          seguranca?: string | null
          tipo_condominio?: string | null
          updated_at?: string
        }
        Update: {
          area_total?: number | null
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_interno?: string | null
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          estado?: string | null
          id?: string
          infraestrutura?: string[]
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          nome?: string
          numero?: string | null
          numero_lotes?: number | null
          portaria?: string | null
          seguranca?: string | null
          tipo_condominio?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      corretores: {
        Row: {
          created_at: string
          creci: string | null
          email: string | null
          foto_url: string | null
          id: string
          imobiliaria_id: string | null
          nome: string
          status: string
          telefone: string | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          creci?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          imobiliaria_id?: string | null
          nome: string
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          creci?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          imobiliaria_id?: string | null
          nome?: string
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corretores_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      edificios: {
        Row: {
          ano_construcao: number | null
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          codigo_interno: string | null
          complemento: string | null
          construtora: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          estado: string | null
          id: string
          infraestrutura: string[]
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          nome: string
          numero: string | null
          qtd_andares: number | null
          qtd_apartamentos: number | null
          qtd_elevadores: number | null
          updated_at: string
        }
        Insert: {
          ano_construcao?: number | null
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_interno?: string | null
          complemento?: string | null
          construtora?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          estado?: string | null
          id?: string
          infraestrutura?: string[]
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          nome: string
          numero?: string | null
          qtd_andares?: number | null
          qtd_apartamentos?: number | null
          qtd_elevadores?: number | null
          updated_at?: string
        }
        Update: {
          ano_construcao?: number | null
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_interno?: string | null
          complemento?: string | null
          construtora?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          estado?: string | null
          id?: string
          infraestrutura?: string[]
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          nome?: string
          numero?: string | null
          qtd_andares?: number | null
          qtd_apartamentos?: number | null
          qtd_elevadores?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      empreendimentos: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          codigo_interno: string | null
          complemento: string | null
          construtora: string | null
          created_at: string
          created_by: string | null
          data_entrega_efetiva: string | null
          data_lancamento: string | null
          data_prevista_entrega: string | null
          descricao: string | null
          estado: string | null
          id: string
          incorporadora: string | null
          infraestrutura: string[]
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          nome: string
          numero: string | null
          status_obra: Database["public"]["Enums"]["status_obra"] | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_interno?: string | null
          complemento?: string | null
          construtora?: string | null
          created_at?: string
          created_by?: string | null
          data_entrega_efetiva?: string | null
          data_lancamento?: string | null
          data_prevista_entrega?: string | null
          descricao?: string | null
          estado?: string | null
          id?: string
          incorporadora?: string | null
          infraestrutura?: string[]
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          nome: string
          numero?: string | null
          status_obra?: Database["public"]["Enums"]["status_obra"] | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_interno?: string | null
          complemento?: string | null
          construtora?: string | null
          created_at?: string
          created_by?: string | null
          data_entrega_efetiva?: string | null
          data_lancamento?: string | null
          data_prevista_entrega?: string | null
          descricao?: string | null
          estado?: string | null
          id?: string
          incorporadora?: string | null
          infraestrutura?: string[]
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          nome?: string
          numero?: string | null
          status_obra?: Database["public"]["Enums"]["status_obra"] | null
          updated_at?: string
        }
        Relationships: []
      }
      estrutura_imagens: {
        Row: {
          capa: boolean
          created_at: string
          created_by: string | null
          estrutura_id: string
          estrutura_tipo: string
          id: string
          ordem: number
          storage_path: string
          url: string
        }
        Insert: {
          capa?: boolean
          created_at?: string
          created_by?: string | null
          estrutura_id: string
          estrutura_tipo: string
          id?: string
          ordem?: number
          storage_path: string
          url: string
        }
        Update: {
          capa?: boolean
          created_at?: string
          created_by?: string | null
          estrutura_id?: string
          estrutura_tipo?: string
          id?: string
          ordem?: number
          storage_path?: string
          url?: string
        }
        Relationships: []
      }
      imobiliarias: {
        Row: {
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          nome_fantasia: string
          owner_id: string | null
          razao_social: string | null
          site: string | null
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome_fantasia: string
          owner_id?: string | null
          razao_social?: string | null
          site?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome_fantasia?: string
          owner_id?: string | null
          razao_social?: string | null
          site?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_options: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          id: string
          nome: string
          ordem: number
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "user"
        | "super_admin"
        | "secretaria"
        | "imobiliaria"
        | "corretor_imobiliaria"
        | "corretor_autonomo"
      arquivo_acao: "upload" | "download" | "exclusao" | "atualizacao"
      arquivo_categoria:
        | "fotos"
        | "documentos"
        | "contratos"
        | "exclusividades"
        | "materiais"
        | "plantas"
        | "outros"
      status_obra: "lancamento" | "em_obras" | "pronto" | "entregue"
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
      app_role: [
        "admin",
        "manager",
        "user",
        "super_admin",
        "secretaria",
        "imobiliaria",
        "corretor_imobiliaria",
        "corretor_autonomo",
      ],
      arquivo_acao: ["upload", "download", "exclusao", "atualizacao"],
      arquivo_categoria: [
        "fotos",
        "documentos",
        "contratos",
        "exclusividades",
        "materiais",
        "plantas",
        "outros",
      ],
      status_obra: ["lancamento", "em_obras", "pronto", "entregue"],
    },
  },
} as const
