import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { apiRequest } from "@/lib/queryClient";

interface XTermTerminalProps {
  agentId: number;
  agentName: string;
  onDisconnect?: () => void;
}

export function XTermTerminal({ agentId, agentName, onDisconnect }: XTermTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);
  const [executing, setExecuting] = useState(false);
  const commandBuffer = useRef<string>("");
  const commandHistory = useRef<string[]>([]);
  const historyIndex = useRef<number>(-1);

  const executeCommand = useCallback(async (cmd: string, term: Terminal) => {
    if (!cmd.trim()) return;
    
    setExecuting(true);
    try {
      const response = await apiRequest("POST", `/api/agents/${agentId}/terminal`, {
        command: cmd
      });
      const data = await response.json();
      
      if (data.success && data.output) {
        const output = data.output.replace(/\n/g, "\r\n");
        term.write(output);
        if (!output.endsWith("\n") && !output.endsWith("\r\n")) {
          term.writeln("");
        }
      } else if (data.message) {
        term.writeln(`\x1b[1;31mErro: ${data.message}\x1b[0m`);
      }
    } catch (error: any) {
      term.writeln(`\x1b[1;31mErro: ${error.message || 'Falha ao executar comando'}\x1b[0m`);
    } finally {
      setExecuting(false);
    }
  }, [agentId]);

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

    const writePrompt = (t: Terminal) => {
      t.write("\x1b[1;32m" + agentName + "\x1b[0m:\x1b[1;34m~\x1b[0m$ ");
    };

    term.writeln("\x1b[1;36m╔════════════════════════════════════════════╗\x1b[0m");
    term.writeln("\x1b[1;36m║\x1b[0m   \x1b[1;33mNBM CLOUD\x1b[0m - Terminal Remoto              \x1b[1;36m║\x1b[0m");
    term.writeln("\x1b[1;36m╚════════════════════════════════════════════╝\x1b[0m");
    term.writeln("");
    term.writeln(`\x1b[1;32m✓ Conectado ao agente: ${agentName}\x1b[0m`);
    term.writeln("\x1b[90mDigite comandos Linux e pressione Enter para executar.\x1b[0m");
    term.writeln("\x1b[90mUse ↑/↓ para histórico. Comandos: clear, help, exit\x1b[0m");
    term.writeln("");
    
    setConnected(true);
    writePrompt(term);

    term.onData(async (data) => {
      if (executing) return;
      
      if (data === "\r") {
        term.writeln("");
        const cmd = commandBuffer.current.trim();
        commandBuffer.current = "";
        historyIndex.current = -1;
        
        if (cmd) {
          commandHistory.current.push(cmd);
          if (commandHistory.current.length > 100) {
            commandHistory.current.shift();
          }
        }
        
        if (cmd === "clear") {
          term.clear();
          writePrompt(term);
        } else if (cmd === "exit") {
          term.writeln("\x1b[1;33m═══ Sessão encerrada ═══\x1b[0m");
          setConnected(false);
          if (onDisconnect) onDisconnect();
        } else if (cmd === "help") {
          term.writeln("\x1b[1;33mComandos disponíveis:\x1b[0m");
          term.writeln("  \x1b[36mclear\x1b[0m       - Limpar terminal");
          term.writeln("  \x1b[36mexit\x1b[0m        - Encerrar sessão");
          term.writeln("  \x1b[36mhelp\x1b[0m        - Exibir esta ajuda");
          term.writeln("  \x1b[36m<comando>\x1b[0m   - Executar comando no servidor do agente");
          term.writeln("");
          term.writeln("\x1b[90mExemplos: ls -la, df -h, free -m, cat /etc/os-release\x1b[0m");
          term.writeln("");
          writePrompt(term);
        } else if (cmd) {
          await executeCommand(cmd, term);
          writePrompt(term);
        } else {
          writePrompt(term);
        }
      } else if (data === "\x7f" || data === "\b") {
        if (commandBuffer.current.length > 0) {
          commandBuffer.current = commandBuffer.current.slice(0, -1);
          term.write("\b \b");
        }
      } else if (data === "\x03") {
        commandBuffer.current = "";
        term.writeln("^C");
        writePrompt(term);
      } else if (data === "\x1b[A") {
        if (commandHistory.current.length > 0) {
          const newIndex = historyIndex.current < commandHistory.current.length - 1 
            ? historyIndex.current + 1 
            : historyIndex.current;
          historyIndex.current = newIndex;
          
          while (commandBuffer.current.length > 0) {
            term.write("\b \b");
            commandBuffer.current = commandBuffer.current.slice(0, -1);
          }
          
          const histCmd = commandHistory.current[commandHistory.current.length - 1 - newIndex];
          commandBuffer.current = histCmd;
          term.write(histCmd);
        }
      } else if (data === "\x1b[B") {
        if (historyIndex.current > 0) {
          historyIndex.current--;
          
          while (commandBuffer.current.length > 0) {
            term.write("\b \b");
            commandBuffer.current = commandBuffer.current.slice(0, -1);
          }
          
          const histCmd = commandHistory.current[commandHistory.current.length - 1 - historyIndex.current];
          commandBuffer.current = histCmd;
          term.write(histCmd);
        } else if (historyIndex.current === 0) {
          historyIndex.current = -1;
          while (commandBuffer.current.length > 0) {
            term.write("\b \b");
            commandBuffer.current = commandBuffer.current.slice(0, -1);
          }
        }
      } else if (data >= " " && data <= "~") {
        commandBuffer.current += data;
        term.write(data);
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
      term.dispose();
    };
  }, [agentName, executing, executeCommand, onDisconnect]);

  useEffect(() => {
    const cleanup = init();
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const handleDisconnect = () => {
    setConnected(false);
    if (onDisconnect) {
      onDisconnect();
    }
  };

  const handleReconnect = () => {
    if (terminalInstance.current) {
      terminalInstance.current.dispose();
      terminalInstance.current = null;
    }
    commandBuffer.current = "";
    commandHistory.current = [];
    historyIndex.current = -1;
    setTimeout(init, 100);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : executing ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-sm text-gray-300">
            {connected ? (executing ? "Executando..." : `Conectado: ${agentName}`) : "Desconectado"}
          </span>
        </div>
        <div className="flex gap-2">
          {!connected && (
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
