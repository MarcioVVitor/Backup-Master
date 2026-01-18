import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface XTermTerminalProps {
  agentId: number;
  agentName: string;
  onDisconnect?: () => void;
}

export function XTermTerminal({ agentId, agentName, onDisconnect }: XTermTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const commandBuffer = useRef<string>("");
  const commandHistory = useRef<string[]>([]);
  const historyIndex = useRef<number>(-1);
  const sessionIdRef = useRef<string>("");

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal`;
    
    console.log("[xterm] Connecting to WebSocket:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[xterm] WebSocket connected, sending connect_shell");
      const cols = terminalInstance.current?.cols || 80;
      const rows = terminalInstance.current?.rows || 24;
      ws.send(JSON.stringify({
        type: "connect_shell",
        agentId,
        cols,
        rows
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[xterm] Received:", data.type);

        if (data.type === "connected") {
          setConnecting(false);
          setConnected(true);
          sessionIdRef.current = data.sessionId || `shell-${agentId}-${Date.now()}`;
        } else if (data.type === "output") {
          if (terminalInstance.current && data.data) {
            let output = data.data;
            if (data.encoding === "base64") {
              try {
                output = atob(data.data);
              } catch (e) {
                console.error("[xterm] Base64 decode error:", e);
              }
            }
            terminalInstance.current.write(output);
          }
        } else if (data.type === "status") {
          if (terminalInstance.current) {
            terminalInstance.current.writeln(`\x1b[90m${data.message}\x1b[0m`);
          }
        } else if (data.type === "error") {
          if (terminalInstance.current) {
            terminalInstance.current.writeln(`\x1b[1;31mErro: ${data.message}\x1b[0m`);
          }
          setConnecting(false);
        } else if (data.type === "disconnected") {
          setConnected(false);
          if (terminalInstance.current) {
            terminalInstance.current.writeln("\x1b[1;33m═══ Conexão encerrada ═══\x1b[0m");
          }
        }
      } catch (e) {
        console.error("[xterm] Parse error:", e);
      }
    };

    ws.onclose = () => {
      console.log("[xterm] WebSocket closed");
      setConnected(false);
      setConnecting(false);
    };

    ws.onerror = (error) => {
      console.error("[xterm] WebSocket error:", error);
      setConnecting(false);
    };
  }, [agentId]);

  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
      wsRef.current.send(JSON.stringify({
        type: "input",
        sessionId: sessionIdRef.current,
        data
      }));
    }
  }, []);

  const sendResize = useCallback((cols: number, rows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
      wsRef.current.send(JSON.stringify({
        type: "resize",
        sessionId: sessionIdRef.current,
        cols,
        rows
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "disconnect" }));
      wsRef.current.close();
    }
    wsRef.current = null;
    setConnected(false);
    if (onDisconnect) onDisconnect();
  }, [onDisconnect]);

  const init = useCallback(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      fontSize: 14,
      theme: {
        background: "#1a1b26",
        foreground: "#a9b1d6",
        cursor: "#c0caf5",
        cursorAccent: "#1a1b26",
        selectionBackground: "#33467c",
        black: "#32344a",
        red: "#f7768e",
        green: "#9ece6a",
        yellow: "#e0af68",
        blue: "#7aa2f7",
        magenta: "#ad8ee6",
        cyan: "#449dab",
        white: "#787c99",
        brightBlack: "#444b6a",
        brightRed: "#ff7a93",
        brightGreen: "#b9f27c",
        brightYellow: "#ff9e64",
        brightBlue: "#7da6ff",
        brightMagenta: "#bb9af7",
        brightCyan: "#0db9d7",
        brightWhite: "#acb0d0",
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();
    
    term.loadAddon(fit);
    term.loadAddon(webLinks);
    
    term.open(terminalRef.current);
    fit.fit();
    
    terminalInstance.current = term;
    fitAddon.current = fit;

    term.writeln("\x1b[1;36m╔════════════════════════════════════════════╗\x1b[0m");
    term.writeln("\x1b[1;36m║\x1b[0m   \x1b[1;33mNBM CLOUD\x1b[0m - Terminal Remoto              \x1b[1;36m║\x1b[0m");
    term.writeln("\x1b[1;36m╚════════════════════════════════════════════╝\x1b[0m");
    term.writeln("");
    term.writeln(`\x1b[90mConectando ao agente: ${agentName}...\x1b[0m`);

    connectWebSocket();

    term.onData((data) => {
      if (!connected && !connecting) return;
      
      // For true PTY mode, send all keystrokes directly to the server
      // The PTY handles echo, line editing, and everything else
      sendInput(data);
    });

    term.onResize(({ cols, rows }) => {
      sendResize(cols, rows);
    });

    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (wsRef.current) {
        wsRef.current.close();
      }
      term.dispose();
    };
  }, [agentName, connected, connecting, connectWebSocket, sendInput, sendResize, disconnect]);

  useEffect(() => {
    const cleanup = init();
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const handleDisconnect = () => {
    disconnect();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : connecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-sm text-muted-foreground">
            {connected ? `Conectado: ${agentName}` : connecting ? 'Conectando...' : 'Desconectado'}
          </span>
        </div>
        {connected && (
          <button
            onClick={handleDisconnect}
            className="px-3 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
            data-testid="button-disconnect-terminal"
          >
            Desconectar
          </button>
        )}
      </div>
      <div 
        ref={terminalRef} 
        className="flex-1 rounded-md overflow-hidden border border-border"
        style={{ minHeight: "400px" }}
        data-testid="terminal-container"
      />
    </div>
  );
}
