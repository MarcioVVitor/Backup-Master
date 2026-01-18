#!/bin/bash
# Install PTY scripts for NBM Agent
# Run: curl -sSL https://your-server/install-pty-scripts.sh | bash

AGENT_DIR="/opt/nbm-agent"

echo "Installing PTY scripts to $AGENT_DIR..."

# Create pty-proxy.py
cat > "$AGENT_DIR/pty-proxy.py" << 'ENDOFFILE'
#!/usr/bin/env python3
import os, sys, pty, select, signal, struct, fcntl, termios

def set_winsize(fd, r, c):
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', r, c, 0, 0))

def main():
    if len(sys.argv) < 2:
        print("Usage: pty-proxy.py <session_id> [rows] [cols]", file=sys.stderr)
        sys.exit(1)
    sid = sys.argv[1]
    rows = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    cols = int(sys.argv[3]) if len(sys.argv) > 3 else 80
    master, slave = pty.openpty()
    set_winsize(master, rows, cols)
    pid = os.fork()
    if pid == 0:
        os.close(master)
        os.setsid()
        os.dup2(slave, 0)
        os.dup2(slave, 1)
        os.dup2(slave, 2)
        if slave > 2:
            os.close(slave)
        env = os.environ.copy()
        env['TERM'] = 'xterm-256color'
        env['SHELL'] = '/bin/bash'
        os.execvpe('/bin/bash', ['/bin/bash', '--login'], env)
    else:
        os.close(slave)
        fl = fcntl.fcntl(sys.stdin.fileno(), fcntl.F_GETFL)
        fcntl.fcntl(sys.stdin.fileno(), fcntl.F_SETFL, fl | os.O_NONBLOCK)
        fl = fcntl.fcntl(master, fcntl.F_GETFL)
        fcntl.fcntl(master, fcntl.F_SETFL, fl | os.O_NONBLOCK)
        def sigchld(s, f):
            try:
                w, st = os.waitpid(pid, os.WNOHANG)
                if w == pid:
                    sys.exit(0)
            except:
                pass
        signal.signal(signal.SIGCHLD, sigchld)
        try:
            while True:
                try:
                    r, _, _ = select.select([sys.stdin, master], [], [], 0.1)
                except:
                    continue
                if sys.stdin in r:
                    try:
                        d = sys.stdin.buffer.read(4096)
                        if d:
                            if d.startswith(b'__RESIZE__:'):
                                try:
                                    p = d.decode().split(':')
                                    if len(p) >= 3:
                                        set_winsize(master, int(p[1]), int(p[2].split('__')[0]))
                                except:
                                    pass
                            elif d.startswith(b'__EXIT__'):
                                os.kill(pid, signal.SIGTERM)
                                break
                            else:
                                os.write(master, d)
                        else:
                            break
                    except:
                        pass
                if master in r:
                    try:
                        d = os.read(master, 4096)
                        if d:
                            sys.stdout.buffer.write(d)
                            sys.stdout.buffer.flush()
                        else:
                            break
                    except OSError:
                        break
                    except:
                        pass
        except KeyboardInterrupt:
            pass
        finally:
            try:
                os.kill(pid, signal.SIGTERM)
                os.waitpid(pid, 0)
            except:
                pass
            os.close(master)

if __name__ == '__main__':
    main()
ENDOFFILE

# Create pty-reader.py
cat > "$AGENT_DIR/pty-reader.py" << 'ENDOFFILE'
#!/usr/bin/env python3
import sys, os, base64, json, select, fcntl

def main():
    if len(sys.argv) < 3:
        print("Usage: pty-reader.py <fifo_path> <session_id>", file=sys.stderr)
        sys.exit(1)
    fifo = sys.argv[1]
    sid = sys.argv[2]
    try:
        fd = os.open(fifo, os.O_RDONLY)
        fl = fcntl.fcntl(fd, fcntl.F_GETFL)
        fcntl.fcntl(fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)
    except OSError as e:
        print(f"Failed to open FIFO: {e}", file=sys.stderr)
        sys.exit(1)
    try:
        while True:
            r, _, _ = select.select([fd], [], [], 1.0)
            if r:
                try:
                    d = os.read(fd, 4096)
                    if not d:
                        break
                    print(json.dumps({"type": "terminal_output", "sessionId": sid, "data": base64.b64encode(d).decode('ascii'), "encoding": "base64"}), flush=True)
                except BlockingIOError:
                    pass
                except OSError:
                    break
    finally:
        os.close(fd)
        print(json.dumps({"type": "shell_closed", "sessionId": sid}), flush=True)

if __name__ == '__main__':
    main()
ENDOFFILE

chmod +x "$AGENT_DIR/pty-proxy.py" "$AGENT_DIR/pty-reader.py"
echo "Done! Scripts installed. Restart agent with: systemctl restart nbm-agent"
