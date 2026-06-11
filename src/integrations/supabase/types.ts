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
      active_sessions: {
        Row: {
          created_at: string
          device: string | null
          id: string
          ip: string | null
          last_seen: string
          status: string
          user_agent: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string
          device?: string | null
          id?: string
          ip?: string | null
          last_seen?: string
          status?: string
          user_agent?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string
          device?: string | null
          id?: string
          ip?: string | null
          last_seen?: string
          status?: string
          user_agent?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
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
      assinaturas: {
        Row: {
          bloqueio_motivo: string | null
          ciclo: string
          created_at: string
          id: string
          imobiliaria_id: string | null
          inicio_em: string
          observacao: string | null
          plano_id: string
          proximo_vencimento: string | null
          status: string
          ultimo_pagamento_em: string | null
          updated_at: string
          usuario_id: string | null
          valor: number
        }
        Insert: {
          bloqueio_motivo?: string | null
          ciclo?: string
          created_at?: string
          id?: string
          imobiliaria_id?: string | null
          inicio_em?: string
          observacao?: string | null
          plano_id: string
          proximo_vencimento?: string | null
          status?: string
          ultimo_pagamento_em?: string | null
          updated_at?: string
          usuario_id?: string | null
          valor?: number
        }
        Update: {
          bloqueio_motivo?: string | null
          ciclo?: string
          created_at?: string
          id?: string
          imobiliaria_id?: string | null
          inicio_em?: string
          observacao?: string | null
          plano_id?: string
          proximo_vencimento?: string | null
          status?: string
          ultimo_pagamento_em?: string | null
          updated_at?: string
          usuario_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          id: string
          ip: string | null
          modulo: string
          perfil: string | null
          registro_id: string | null
          registro_tipo: string | null
          status: string
          user_agent: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          ip?: string | null
          modulo: string
          perfil?: string | null
          registro_id?: string | null
          registro_tipo?: string | null
          status?: string
          user_agent?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          ip?: string | null
          modulo?: string
          perfil?: string | null
          registro_id?: string | null
          registro_tipo?: string | null
          status?: string
          user_agent?: string | null
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
      buscas_salvas: {
        Row: {
          created_at: string
          filtros_json: Json
          id: string
          nome: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          filtros_json?: Json
          id?: string
          nome: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          filtros_json?: Json
          id?: string
          nome?: string
          usuario_id?: string
        }
        Relationships: []
      }
      carteira_compartilhamentos: {
        Row: {
          carteira_id: string
          created_at: string
          id: string
          permissao: string
          usuario_id: string
        }
        Insert: {
          carteira_id: string
          created_at?: string
          id?: string
          permissao?: string
          usuario_id: string
        }
        Update: {
          carteira_id?: string
          created_at?: string
          id?: string
          permissao?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carteira_compartilhamentos_carteira_id_fkey"
            columns: ["carteira_id"]
            isOneToOne: false
            referencedRelation: "carteiras"
            referencedColumns: ["id"]
          },
        ]
      }
      carteira_imoveis: {
        Row: {
          carteira_id: string
          created_at: string
          id: string
          imovel_id: string
        }
        Insert: {
          carteira_id: string
          created_at?: string
          id?: string
          imovel_id: string
        }
        Update: {
          carteira_id?: string
          created_at?: string
          id?: string
          imovel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carteira_imoveis_carteira_id_fkey"
            columns: ["carteira_id"]
            isOneToOne: false
            referencedRelation: "carteiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carteira_imoveis_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      carteira_portais: {
        Row: {
          ativo: boolean
          carteira_id: string
          created_at: string
          id: string
          mensagem_erro: string | null
          portal_id: string
          status_sincronizacao: string
          total_leituras: number
          ultima_leitura: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          carteira_id: string
          created_at?: string
          id?: string
          mensagem_erro?: string | null
          portal_id: string
          status_sincronizacao?: string
          total_leituras?: number
          ultima_leitura?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          carteira_id?: string
          created_at?: string
          id?: string
          mensagem_erro?: string | null
          portal_id?: string
          status_sincronizacao?: string
          total_leituras?: number
          ultima_leitura?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carteira_portais_carteira_id_fkey"
            columns: ["carteira_id"]
            isOneToOne: false
            referencedRelation: "carteiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carteira_portais_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portais"
            referencedColumns: ["id"]
          },
        ]
      }
      carteiras: {
        Row: {
          atualizacao_intervalo: string
          created_at: string
          descricao: string | null
          id: string
          limite_imoveis: number | null
          marca_dagua: boolean
          nome: string
          regra_filtros: Json
          slug: string
          status: string
          ultima_atualizacao: string | null
          updated_at: string
          usuario_id: string
          visibilidade: string
        }
        Insert: {
          atualizacao_intervalo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          limite_imoveis?: number | null
          marca_dagua?: boolean
          nome: string
          regra_filtros?: Json
          slug: string
          status?: string
          ultima_atualizacao?: string | null
          updated_at?: string
          usuario_id: string
          visibilidade?: string
        }
        Update: {
          atualizacao_intervalo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          limite_imoveis?: number | null
          marca_dagua?: boolean
          nome?: string
          regra_filtros?: Json
          slug?: string
          status?: string
          ultima_atualizacao?: string | null
          updated_at?: string
          usuario_id?: string
          visibilidade?: string
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
      exportacao_itens: {
        Row: {
          created_at: string
          id: string
          imovel_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          imovel_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          imovel_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exportacao_itens_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_logs: {
        Row: {
          acao: string
          carteira_id: string
          created_at: string
          detalhes: Json | null
          id: string
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          acao: string
          carteira_id: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          acao?: string
          carteira_id?: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_logs_carteira_id_fkey"
            columns: ["carteira_id"]
            isOneToOne: false
            referencedRelation: "carteiras"
            referencedColumns: ["id"]
          },
        ]
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
      imoveis: {
        Row: {
          aceita_permuta: boolean
          area_privativa: number | null
          area_total: number | null
          arquivado: boolean
          ativo_site: boolean
          bairro: string | null
          banheiros: number | null
          bonus: string | null
          box: string | null
          cep: string | null
          cidade: string | null
          codigo_interno: string | null
          comissao_compartilhada: number | null
          comissao_percentual: number | null
          compartilhamento_permitido: boolean
          complemento: string | null
          condicao: string | null
          condicoes_pagamento: string[]
          condominio_id: string | null
          corretor_id: string | null
          created_at: string
          created_by: string | null
          data_captacao: string | null
          data_vencimento_exclusividade: string | null
          decorado: boolean
          descricao: string | null
          destaque_categoria: string | null
          destaque_home: boolean
          dormitorios: number | null
          edificio_id: string | null
          elevadores: number | null
          empreendimento_id: string | null
          estado: string | null
          exclusividade: boolean
          exclusivo: boolean
          exportacao_liberada: boolean
          id: string
          imobiliaria_id: string | null
          infraestrutura: string[]
          latitude: number | null
          lavabo: number | null
          link_drive_fotos: string | null
          link_material: string | null
          link_video: string | null
          local_chaves: string | null
          logradouro: string | null
          longitude: number | null
          lote: string | null
          loteamento_id: string | null
          numero: string | null
          observacoes_internas: string | null
          outras_caracteristicas: string[]
          padrao: string | null
          pdf_comercial_path: string | null
          portais_permitidos: string[]
          posicao_predio: string | null
          posicao_solar: string | null
          preco: number | null
          preco_parcelado: number | null
          prioridade_xml: number
          publicar_xml: boolean
          quadra: string | null
          responsavel_captacao: string | null
          responsavel_email: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          responsavel_whatsapp: string | null
          status_exportacao: string | null
          status_imovel: string
          termo_exclusividade_path: string | null
          tipo_imovel: string | null
          tipo_proprietario: string | null
          titulo: string
          tour_360: string | null
          ultima_exportacao: string | null
          unidade: string | null
          updated_at: string
          vagas: number | null
          validade_bonus: string | null
          valor_comissao: number | null
          vista: string | null
          vista_mar: boolean
        }
        Insert: {
          aceita_permuta?: boolean
          area_privativa?: number | null
          area_total?: number | null
          arquivado?: boolean
          ativo_site?: boolean
          bairro?: string | null
          banheiros?: number | null
          bonus?: string | null
          box?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_interno?: string | null
          comissao_compartilhada?: number | null
          comissao_percentual?: number | null
          compartilhamento_permitido?: boolean
          complemento?: string | null
          condicao?: string | null
          condicoes_pagamento?: string[]
          condominio_id?: string | null
          corretor_id?: string | null
          created_at?: string
          created_by?: string | null
          data_captacao?: string | null
          data_vencimento_exclusividade?: string | null
          decorado?: boolean
          descricao?: string | null
          destaque_categoria?: string | null
          destaque_home?: boolean
          dormitorios?: number | null
          edificio_id?: string | null
          elevadores?: number | null
          empreendimento_id?: string | null
          estado?: string | null
          exclusividade?: boolean
          exclusivo?: boolean
          exportacao_liberada?: boolean
          id?: string
          imobiliaria_id?: string | null
          infraestrutura?: string[]
          latitude?: number | null
          lavabo?: number | null
          link_drive_fotos?: string | null
          link_material?: string | null
          link_video?: string | null
          local_chaves?: string | null
          logradouro?: string | null
          longitude?: number | null
          lote?: string | null
          loteamento_id?: string | null
          numero?: string | null
          observacoes_internas?: string | null
          outras_caracteristicas?: string[]
          padrao?: string | null
          pdf_comercial_path?: string | null
          portais_permitidos?: string[]
          posicao_predio?: string | null
          posicao_solar?: string | null
          preco?: number | null
          preco_parcelado?: number | null
          prioridade_xml?: number
          publicar_xml?: boolean
          quadra?: string | null
          responsavel_captacao?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          responsavel_whatsapp?: string | null
          status_exportacao?: string | null
          status_imovel?: string
          termo_exclusividade_path?: string | null
          tipo_imovel?: string | null
          tipo_proprietario?: string | null
          titulo: string
          tour_360?: string | null
          ultima_exportacao?: string | null
          unidade?: string | null
          updated_at?: string
          vagas?: number | null
          validade_bonus?: string | null
          valor_comissao?: number | null
          vista?: string | null
          vista_mar?: boolean
        }
        Update: {
          aceita_permuta?: boolean
          area_privativa?: number | null
          area_total?: number | null
          arquivado?: boolean
          ativo_site?: boolean
          bairro?: string | null
          banheiros?: number | null
          bonus?: string | null
          box?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_interno?: string | null
          comissao_compartilhada?: number | null
          comissao_percentual?: number | null
          compartilhamento_permitido?: boolean
          complemento?: string | null
          condicao?: string | null
          condicoes_pagamento?: string[]
          condominio_id?: string | null
          corretor_id?: string | null
          created_at?: string
          created_by?: string | null
          data_captacao?: string | null
          data_vencimento_exclusividade?: string | null
          decorado?: boolean
          descricao?: string | null
          destaque_categoria?: string | null
          destaque_home?: boolean
          dormitorios?: number | null
          edificio_id?: string | null
          elevadores?: number | null
          empreendimento_id?: string | null
          estado?: string | null
          exclusividade?: boolean
          exclusivo?: boolean
          exportacao_liberada?: boolean
          id?: string
          imobiliaria_id?: string | null
          infraestrutura?: string[]
          latitude?: number | null
          lavabo?: number | null
          link_drive_fotos?: string | null
          link_material?: string | null
          link_video?: string | null
          local_chaves?: string | null
          logradouro?: string | null
          longitude?: number | null
          lote?: string | null
          loteamento_id?: string | null
          numero?: string | null
          observacoes_internas?: string | null
          outras_caracteristicas?: string[]
          padrao?: string | null
          pdf_comercial_path?: string | null
          portais_permitidos?: string[]
          posicao_predio?: string | null
          posicao_solar?: string | null
          preco?: number | null
          preco_parcelado?: number | null
          prioridade_xml?: number
          publicar_xml?: boolean
          quadra?: string | null
          responsavel_captacao?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          responsavel_whatsapp?: string | null
          status_exportacao?: string | null
          status_imovel?: string
          termo_exclusividade_path?: string | null
          tipo_imovel?: string | null
          tipo_proprietario?: string | null
          titulo?: string
          tour_360?: string | null
          ultima_exportacao?: string | null
          unidade?: string | null
          updated_at?: string
          vagas?: number | null
          validade_bonus?: string | null
          valor_comissao?: number | null
          vista?: string | null
          vista_mar?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "imoveis_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveis_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveis_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "edificios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveis_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveis_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveis_loteamento_id_fkey"
            columns: ["loteamento_id"]
            isOneToOne: false
            referencedRelation: "loteamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      imoveis_favoritos: {
        Row: {
          created_at: string
          id: string
          imovel_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          imovel_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          imovel_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imoveis_favoritos_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      imovel_imagens: {
        Row: {
          capa: boolean
          created_at: string
          created_by: string | null
          id: string
          imovel_id: string
          ordem: number
          storage_path: string
          url: string | null
        }
        Insert: {
          capa?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          imovel_id: string
          ordem?: number
          storage_path: string
          url?: string | null
        }
        Update: {
          capa?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          imovel_id?: string
          ordem?: number
          storage_path?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imovel_imagens_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      imovel_logs: {
        Row: {
          acao: string
          created_at: string
          descricao: string | null
          id: string
          imovel_id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          descricao?: string | null
          id?: string
          imovel_id: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          descricao?: string | null
          id?: string
          imovel_id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imovel_logs_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      loteamentos: {
        Row: {
          area_total_m2: number | null
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
          infraestrutura: Json | null
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          lotes_disponiveis: number | null
          nome: string
          numero: string | null
          observacoes: string | null
          total_lotes: number | null
          updated_at: string
        }
        Insert: {
          area_total_m2?: number | null
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
          infraestrutura?: Json | null
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          lotes_disponiveis?: number | null
          nome: string
          numero?: string | null
          observacoes?: string | null
          total_lotes?: number | null
          updated_at?: string
        }
        Update: {
          area_total_m2?: number | null
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
          infraestrutura?: Json | null
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          lotes_disponiveis?: number | null
          nome?: string
          numero?: string | null
          observacoes?: string | null
          total_lotes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          canal_email: boolean
          canal_push: boolean
          canal_sistema: boolean
          canal_whatsapp: boolean
          created_at: string
          id: string
          tipo: Database["public"]["Enums"]["notification_tipo"]
          updated_at: string
          usuario_id: string
        }
        Insert: {
          canal_email?: boolean
          canal_push?: boolean
          canal_sistema?: boolean
          canal_whatsapp?: boolean
          created_at?: string
          id?: string
          tipo: Database["public"]["Enums"]["notification_tipo"]
          updated_at?: string
          usuario_id: string
        }
        Update: {
          canal_email?: boolean
          canal_push?: boolean
          canal_sistema?: boolean
          canal_whatsapp?: boolean
          created_at?: string
          id?: string
          tipo?: Database["public"]["Enums"]["notification_tipo"]
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          categoria: Database["public"]["Enums"]["notification_categoria"]
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          metadata: Json
          tipo: Database["public"]["Enums"]["notification_tipo"]
          titulo: string
          usuario_id: string
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["notification_categoria"]
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          metadata?: Json
          tipo?: Database["public"]["Enums"]["notification_tipo"]
          titulo: string
          usuario_id: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["notification_categoria"]
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          metadata?: Json
          tipo?: Database["public"]["Enums"]["notification_tipo"]
          titulo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          assinatura_id: string
          competencia: string | null
          comprovante_url: string | null
          created_at: string
          id: string
          metodo: string
          observacao: string | null
          pago_em: string | null
          registrado_por: string | null
          status: string
          updated_at: string
          valor: number
          vencimento: string | null
        }
        Insert: {
          assinatura_id: string
          competencia?: string | null
          comprovante_url?: string | null
          created_at?: string
          id?: string
          metodo?: string
          observacao?: string | null
          pago_em?: string | null
          registrado_por?: string | null
          status?: string
          updated_at?: string
          valor: number
          vencimento?: string | null
        }
        Update: {
          assinatura_id?: string
          competencia?: string | null
          comprovante_url?: string | null
          created_at?: string
          id?: string
          metodo?: string
          observacao?: string | null
          pago_em?: string | null
          registrado_por?: string | null
          status?: string
          updated_at?: string
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "assinaturas"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          limite_carteiras: number | null
          limite_usuarios: number | null
          nome: string
          ordem: number
          permite_exportacao: boolean
          preco_anual: number | null
          preco_mensal: number
          recursos: Json
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          limite_carteiras?: number | null
          limite_usuarios?: number | null
          nome: string
          ordem?: number
          permite_exportacao?: boolean
          preco_anual?: number | null
          preco_mensal?: number
          recursos?: Json
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          limite_carteiras?: number | null
          limite_usuarios?: number | null
          nome?: string
          ordem?: number
          permite_exportacao?: boolean
          preco_anual?: number | null
          preco_mensal?: number
          recursos?: Json
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      portais: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          descricao: string | null
          formato_xml: string
          id: string
          instrucoes: string | null
          logo_url: string | null
          nome: string
          ordem: number
          site_url: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          descricao?: string | null
          formato_xml?: string
          id?: string
          instrucoes?: string | null
          logo_url?: string | null
          nome: string
          ordem?: number
          site_url?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          descricao?: string | null
          formato_xml?: string
          id?: string
          instrucoes?: string | null
          logo_url?: string | null
          nome?: string
          ordem?: number
          site_url?: string | null
          slug?: string
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
      security_alerts: {
        Row: {
          created_at: string
          descricao: string
          id: string
          metadata: Json | null
          severidade: string
          status: string
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          metadata?: Json | null
          severidade?: string
          status?: string
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          metadata?: Json | null
          severidade?: string
          status?: string
          tipo?: string
          usuario_id?: string | null
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
      contar_nao_lidas: { Args: never; Returns: number }
      create_security_alert: {
        Args: {
          p_descricao?: string
          p_metadata?: Json
          p_severidade?: string
          p_tipo: string
        }
        Returns: string
      }
      criar_notificacao: {
        Args: {
          p_categoria?: Database["public"]["Enums"]["notification_categoria"]
          p_link?: string
          p_mensagem: string
          p_metadata?: Json
          p_tipo: Database["public"]["Enums"]["notification_tipo"]
          p_titulo: string
          p_usuario_id: string
        }
        Returns: string
      }
      get_contato_publico: { Args: { p_slug: string }; Returns: string }
      get_corretor_contato: {
        Args: { p_corretor_id: string }
        Returns: {
          email: string
          telefone: string
          whatsapp: string
        }[]
      }
      get_imobiliaria_contato: {
        Args: { p_imobiliaria_id: string }
        Returns: {
          cnpj: string
          email: string
          telefone: string
        }[]
      }
      get_imovel_internal: {
        Args: { p_imovel_id: string }
        Returns: {
          comissao_percentual: number
          local_chaves: string
          observacoes_internas: string
          pdf_comercial_path: string
          responsavel_email: string
          responsavel_nome: string
          responsavel_telefone: string
          responsavel_whatsapp: string
          termo_exclusividade_path: string
          valor_comissao: number
        }[]
      }
      get_minha_assinatura: {
        Args: never
        Returns: {
          assinatura_id: string
          bloqueio_motivo: string
          ciclo: string
          plano_id: string
          plano_nome: string
          proximo_vencimento: string
          status: string
          titular: string
          valor: number
        }[]
      }
      get_oportunidades_resumo: {
        Args: never
        Returns: {
          alto_padrao: number
          atualizados_7d: number
          com_bonus: number
          destaque: number
          exclusivos: number
          novos_30d: number
          novos_7d: number
          novos_hoje: number
          vista_mar: number
        }[]
      }
      get_preferencias_notificacao: {
        Args: never
        Returns: {
          canal_email: boolean
          canal_push: boolean
          canal_sistema: boolean
          canal_whatsapp: boolean
          tipo: Database["public"]["Enums"]["notification_tipo"]
        }[]
      }
      get_ranking_corretores: {
        Args: { p_limit?: number; p_metrica?: string; p_periodo?: string }
        Returns: {
          classificacao: string
          corretor_user_id: string
          downloads: number
          exportacoes: number
          favoritos: number
          foto_url: string
          imobiliaria_nome: string
          logins: number
          nome: string
          score: number
          visualizacoes: number
        }[]
      }
      get_ranking_imoveis: {
        Args: { p_limit?: number; p_metrica?: string; p_periodo?: string }
        Returns: {
          bairro: string
          cidade: string
          codigo_interno: string
          cover_url: string
          downloads: number
          exportacoes: number
          favoritos: number
          imovel_id: string
          preco: number
          score: number
          titulo: string
          visualizacoes: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      imobiliaria_limite_corretores: {
        Args: { p_imob: string }
        Returns: {
          limite: number
          usados: number
        }[]
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_action: {
        Args: {
          p_acao: string
          p_dados_anteriores?: Json
          p_dados_novos?: Json
          p_descricao?: string
          p_modulo: string
          p_registro_id?: string
          p_registro_tipo?: string
          p_status?: string
          p_user_agent?: string
        }
        Returns: string
      }
      marcar_notificacao_lida: { Args: { p_id: string }; Returns: boolean }
      marcar_todas_lidas: {
        Args: {
          p_categoria?: Database["public"]["Enums"]["notification_categoria"]
        }
        Returns: number
      }
      pode_editar_carteira: {
        Args: { _carteira_id: string; _user_id: string }
        Returns: boolean
      }
      pode_ler_carteira: {
        Args: { _carteira_id: string; _user_id: string }
        Returns: boolean
      }
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
      notification_categoria: "imoveis" | "xml" | "portais" | "sistema"
      notification_tipo:
        | "novo_imovel"
        | "imovel_atualizado"
        | "novo_exclusivo"
        | "novo_bonus"
        | "xml_atualizado"
        | "erro_xml"
        | "publicacao_aprovada"
        | "publicacao_rejeitada"
        | "sistema"
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
      notification_categoria: ["imoveis", "xml", "portais", "sistema"],
      notification_tipo: [
        "novo_imovel",
        "imovel_atualizado",
        "novo_exclusivo",
        "novo_bonus",
        "xml_atualizado",
        "erro_xml",
        "publicacao_aprovada",
        "publicacao_rejeitada",
        "sistema",
      ],
      status_obra: ["lancamento", "em_obras", "pronto", "entregue"],
    },
  },
} as const
