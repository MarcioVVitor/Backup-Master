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
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!terminalRef.current) return;
    
    setConnecting(true);
    setError(null);

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
    term.writeln(`\x1b[90mConectando ao agente: \x1b[1;32m${agentName}\x1b[0m\x1b[90m...\x1b[0m`);
    term.writeln("");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "connect_shell",
        agentId: agentId,
        cols: term.cols,
        rows: term.rows
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "status") {
          term.writeln(`\x1b[90m${data.message}\x1b[0m`);
        } else if (data.type === "connected") {
          setConnected(true);
          setConnecting(false);
          term.writeln(`\x1b[1;32m✓ Conectado ao shell do agente ${data.agent}\x1b[0m`);
          term.writeln("");
        } else if (data.type === "output") {
          term.write(data.data);
        } else if (data.type === "error") {
          term.writeln(`\x1b[1;31mErro: ${data.message}\x1b[0m`);
          setError(data.message);
          setConnecting(false);
        }
      } catch (e) {
        term.write(event.data);
      }
    };

    ws.onerror = () => {
      term.writeln("\x1b[1;31m✗ Erro de conexão WebSocket\x1b[0m");
      setError("Erro de conexão");
      setConnecting(false);
    };

    ws.onclose = () => {
      term.writeln("");
      term.writeln("\x1b[1;33m═══ Conexão encerrada ═══\x1b[0m");
      setConnected(false);
      setConnecting(false);
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "input",
          data: data
        }));
      }
    });

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "resize",
          cols,
          rows
        }));
      }
    });

    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "disconnect" }));
        ws.close();
      }
      term.dispose();
    };
  }, [agentId, agentName]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (cleanup) cleanup();
    };
  }, [connect]);

  const handleDisconnect = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "disconnect" }));
      wsRef.current.close();
    }
    if (onDisconnect) {
      onDisconnect();
    }
  };

  const handleReconnect = () => {
    if (terminalInstance.current) {
      terminalInstance.current.dispose();
      terminalInstance.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setTimeout(connect, 100);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : connecting ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-sm text-gray-300">
            {connected ? `Conectado: ${agentName}` : connecting ? "Conectando..." : "Desconectado"}
          </span>
        </div>
        <div className="flex gap-2">
          {!connected && !connecting && (
            <button
              onClick={handleReconnect}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
              data-testid="button-reconnect"
            >
              Reconectar
            </button>
          )}
          <button
            onClick={handleDisconnect}
            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
            data-testid="button-disconnect"
          >
            Desconectar
          </button>
        </div>
      </div>
      <div 
        ref={terminalRef} 
        className="flex-1 bg-[#1a1b26]"
        style={{ minHeight: "400px" }}
        data-testid="xterm-container"
      />
    </div>
  );
}
