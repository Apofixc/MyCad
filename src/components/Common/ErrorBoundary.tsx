import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RotateCcw, Copy, Check, RefreshCw } from "lucide-react";
import { useErrorStore } from "../../stores/errorStore";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Регистрируем ошибку рендеринга в глобальном хранилище ошибок
    useErrorStore.getState().addError(
      {
        message: error.message || "Ошибка отрисовки компонента",
        details: `${error.stack || ""}\n\nComponent Stack:\n${errorInfo.componentStack || ""}`,
      },
      {
        level: "error",
        source: "render",
        toast: true,
      }
    );
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    });
    this.props.onReset?.();
  };

  private handleCopy = async (): Promise<void> => {
    const { error, errorInfo } = this.state;
    const errorText = `[MyCad Render Error]\nMessage: ${error?.message || "Unknown error"}\n\nStack:\n${
      error?.stack || "No stack trace"
    }\n\nComponent Stack:\n${errorInfo?.componentStack || "No component stack"}`;

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Fallback
    }
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo, copied, showDetails } = this.state;
      const title = this.props.fallbackTitle || "Произошла ошибка при отображении";
      const message =
        this.props.fallbackMessage ||
        "В работе интерфейса возникла непредвиденная ошибка рендеринга.";

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "280px",
            width: "100%",
            height: "100%",
            padding: "24px",
            background: "radial-gradient(ellipse at center, rgba(30, 20, 25, 0.9) 0%, rgba(12, 14, 18, 0.98) 100%)",
            color: "var(--cad-text-main)",
            fontFamily: "var(--cad-font-ui)",
            boxSizing: "border-box",
            borderRadius: "8px",
            border: "1px solid rgba(239, 68, 68, 0.3)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
              boxShadow: "0 0 24px rgba(239, 68, 68, 0.25)",
            }}
          >
            <AlertOctagon size={28} color="#ef4444" />
          </div>

          <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 8px 0", color: "#fca5a5" }}>
            {title}
          </h3>

          <p
            style={{
              fontSize: "13px",
              color: "var(--cad-text-muted)",
              textAlign: "center",
              maxWidth: "520px",
              lineHeight: 1.5,
              margin: "0 0 20px 0",
            }}
          >
            {message}
          </p>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={this.handleReset}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "6px",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                color: "#ffffff",
                fontSize: "12.5px",
                fontWeight: 500,
                border: "1px solid rgba(255, 255, 255, 0.15)",
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(37, 99, 235, 0.3)",
              }}
            >
              <RotateCcw size={14} />
              Повторить попытку
            </button>

            <button
              onClick={this.handleCopy}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "6px",
                background: "rgba(255, 255, 255, 0.08)",
                color: "#e2e8f0",
                fontSize: "12.5px",
                fontWeight: 500,
                border: "1px solid rgba(255, 255, 255, 0.12)",
                cursor: "pointer",
              }}
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? "Скопировано!" : "Скопировать ошибку"}
            </button>

            <button
              onClick={this.handleReload}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "6px",
                background: "rgba(239, 68, 68, 0.12)",
                color: "#fca5a5",
                fontSize: "12.5px",
                fontWeight: 500,
                border: "1px solid rgba(239, 68, 68, 0.25)",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} />
              Перезагрузить приложение
            </button>
          </div>

          <button
            onClick={() => this.setState({ showDetails: !showDetails })}
            style={{
              marginTop: "16px",
              background: "transparent",
              border: "none",
              color: "var(--cad-text-dim)",
              fontSize: "12px",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            {showDetails ? "Скрыть технические подробности ▲" : "Показать технические подробности ▼"}
          </button>

          {showDetails && (
            <div
              style={{
                marginTop: "12px",
                width: "100%",
                maxWidth: "680px",
                maxHeight: "180px",
                overflowY: "auto",
                background: "rgba(0, 0, 0, 0.6)",
                borderRadius: "6px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "10px 12px",
                fontSize: "11px",
                fontFamily: "var(--cad-font-mono)",
                color: "#f87171",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                textAlign: "left",
              }}
            >
              <strong>{error?.toString()}</strong>
              {"\n\n"}
              {error?.stack}
              {"\n\nComponent Stack:"}
              {errorInfo?.componentStack}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
