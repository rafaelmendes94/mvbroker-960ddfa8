// Shim that adapts react-router-dom API on top of TanStack Router.
import { Link as TLink, useNavigate as tUseNavigate, useRouter, useSearch, useLocation as tUseLocation } from "@tanstack/react-router";
import * as React from "react";

export const Link = React.forwardRef<HTMLAnchorElement, any>(function Link(
  { to, replace, state, children, ...rest }: any,
  ref
) {
  const target = typeof to === "string" ? to : "/";
  return (
    <TLink ref={ref as any} to={target} replace={replace} {...rest}>
      {children}
    </TLink>
  );
}) as any;

export function useNavigate() {
  const nav = tUseNavigate();
  return (to: any, opts?: any) => {
    if (typeof to === "number") {
      if (typeof window !== "undefined") window.history.go(to);
      return;
    }
    nav({ to, replace: opts?.replace });
  };
}

export function useSearchParams(): [URLSearchParams, (next: any, opts?: { replace?: boolean }) => void] {
  const router = useRouter();
  const search = (typeof window !== "undefined" ? window.location.search : "") || "";
  const params = new URLSearchParams(search);
  const set = (next: any, opts?: { replace?: boolean }) => {
    const value = typeof next === "function" ? next(new URLSearchParams(params)) : next;
    const qs = value.toString();
    const url = (typeof window !== "undefined" ? window.location.pathname : "/") + (qs ? `?${qs}` : "");
    router.navigate({ to: url, replace: opts?.replace });
  };
  return [params, set];
}

export function useLocation() {
  return tUseLocation();
}

export function useParams<T = Record<string, string>>(): T {
  if (typeof window === "undefined") return {} as T;
  return {} as T;
}
