# Inteligência Comercial — Oportunidades, Notificações e Rankings

Como o escopo é muito grande para um único ciclo, proponho dividir em **3 fases independentes e funcionais**, cada uma encerra uma migration + telas prontas, sem deixar nada quebrado no meio do caminho.

---

## Fase 1 — Notificações (base para tudo)

### Banco
- `notifications`: `usuario_id`, `titulo`, `mensagem`, `tipo` (enum: `novo_imovel`, `imovel_atualizado`, `novo_exclusivo`, `novo_bonus`, `xml_atualizado`, `erro_xml`, `publicacao_aprovada`, `publicacao_rejeitada`, `sistema`), `categoria` (`imoveis`|`xml`|`portais`|`sistema`), `lida`, `link`, `metadata jsonb`, `created_at`
- `notification_preferences`: `usuario_id`, `tipo`, `canal_sistema`, `canal_email`, `canal_whatsapp` (futuro), `canal_push` (futuro)
- RLS: usuário só vê/edita as próprias notificações
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE notifications`
- Triggers iniciais: novo `imoveis` (INSERT) → cria notificação para `super_admin`/`secretaria` + dono da carteira; UPDATE em `imoveis` com mudança em `valor`/`bonus`/`exclusividade`/`fotos` → notificação contextual

### Frontend
- `useNotifications()` (Realtime + contador não lidas)
- Sino na topbar com badge → popover (últimas 10 + "ver todas")
- `/notificacoes` central com filtros (Todas, Não lidas, Imóveis, XML, Portais, Sistema), marcar lida, marcar todas, excluir
- `/configuracoes/notificacoes` preferências por tipo × canal (sistema/email ativos, whatsapp/push como "em breve")

---

## Fase 2 — Oportunidades (tela principal de Corretor/Imobiliária)

### Banco
- Coluna `score_qualidade int` em `imoveis` + função `calc_score_imovel(imovel_id)` (fotos, descrição, vídeo, tour, infra, localização, documentos)
- View `vw_imoveis_destaque` agregando flags (exclusivo, bônus, vista_mar, alto_padrao, lançamento, decorado)
- RPC `get_oportunidades_resumo()` → contadores do dashboard (hoje/7d/30d, exclusivos, com bônus, etc.)

### Frontend
- Rota `/oportunidades` (passa a ser landing pós-login para corretor/imobiliária)
- Dashboard com cards de indicadores
- Seções horizontais (scroll): Recém Cadastrados, Atualizações Recentes (usa `imovel_logs`), Exclusividades 🔥, Com Bônus 💰, Vista Mar, Decorados, Lançamentos, Alto Padrão, Mais Visualizados, Mais Exportados, Favoritos
- Badge de Score (Excelente/Bom/Regular/Incompleto) no card
- Reaproveita `ImovelCard` existente

---

## Fase 3 — Rankings + Score de Corretor

### Banco
- `imovel_metricas`: `imovel_id`, `visualizacoes`, `downloads_fotos`, `downloads_docs`, `exportacoes`, `favoritos`, `compartilhamentos_wpp`, `compartilhamentos_pdf`, `compartilhamentos_link`, `buscas_hits`, `updated_at`
- `corretor_metricas`: `corretor_id`, `logins`, `visualizacoes`, `downloads`, `exportacoes`, `carteiras_atualizadas`, `score`, `classificacao` (`ouro`|`prata`|`bronze`)
- RPCs `get_ranking_imoveis(tipo, limit)` e `get_ranking_corretores(tipo, limit)`
- Trigger/edge para incrementar contadores em eventos (já parcialmente capturados em `audit_logs`/`imovel_logs`/`feed_logs`)

### Frontend
- `/relatorios/ranking-imoveis` — abas: Mais Visualizados, Exportados, Baixados, Favoritados, Compartilhados, Procurados (Top 10 cada)
- `/relatorios/ranking-corretores` — abas: Mais Ativos, Exportações, Downloads, Visualizações, Favoritos + Score com classificação Ouro/Prata/Bronze
- Para perfil Imobiliária: pódio 🥇🥈🥉 dos próprios corretores
- `/dashboard-executivo` (super_admin/secretaria) consolidando tudo

---

## Sidebar / Permissions
- Novo grupo "Inteligência" com: Oportunidades, Notificações
- Em Relatórios: Ranking de Imóveis, Ranking de Corretores, Dashboard Executivo
- Atualizar `src/lib/permissions.ts`

## Fora de escopo (estrutura pronta, sem implementação)
- Envio real de e-mail/WhatsApp/Push (apenas armazena preferência)
- Job assíncrono para recálculo periódico de scores (faremos cálculo on-read + trigger pontual)

## Ordem de execução
**Confirma a Fase 1 primeiro?** Entrego notificações funcionando com Realtime + sino + central + preferências, e em seguida abro a Fase 2.