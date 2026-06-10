import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Retorna um handler que volta para a página anterior se existir histórico,
 * ou navega para o fallback (por padrão "/") como rota segura.
 */
export function useSmartBack(fallback: string = "/") {
  const navigate = useNavigate();
  return useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  }, [navigate, fallback]);
}
