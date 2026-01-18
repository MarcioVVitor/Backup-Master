#!/usr/bin/env python3
"""
PTY Shell for NBM Cloud Agent
Single script that handles PTY creation and JSON output for WebSocket
"""

import os
import sys
import pty
import select
import signal
import struct
import fcntl
import termios
import base64
import json

def set_winsize(fd, rows, cols):
    winsize = struct.pack('HHHH', rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"type": "error", "message": "Usage: pty-shell.py <session_id> [rows] [cols]"}), flush=True)
        sys.exit(1)
    
    session_id = sys.argv[1]
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
        
        # Set non-blocking
        fl = fcntl.fcntl(master, fcntl.F_GETFL)
        fcntl.fcntl(master, fcntl.F_SETFL, fl | os.O_NONBLOCK)
        
        # Signal connected
        print(json.dumps({"type": "shell_connected", "sessionId": session_id, "pty": True}), flush=True)
        
        def cleanup(signum=None, frame=None):
            try:
                os.kill(pid, signal.SIGTERM)
                os.waitpid(pid, os.WNOHANG)
            except:
                pass
            print(json.dumps({"type": "shell_closed", "sessionId": session_id}), flush=True)
            sys.exit(0)
        
        signal.signal(signal.SIGCHLD, cleanup)
        signal.signal(signal.SIGTERM, cleanup)
        
        # Create input FIFO
        fifo_path = f"/tmp/nbm-pty-{session_id}.fifo"
        try:
            os.unlink(fifo_path)
        except:
            pass
        os.mkfifo(fifo_path)
        
        # Open FIFO for reading (non-blocking)
        fifo_fd = os.open(fifo_path, os.O_RDONLY | os.O_NONBLOCK)
        
        try:
            while True:
                try:
                    rlist, _, _ = select.select([master, fifo_fd], [], [], 0.1)
                except:
                    continue
                
                # Read from FIFO (input from agent)
                if fifo_fd in rlist:
                    try:
                        data = os.read(fifo_fd, 4096)
                        if data:
                            # Check for special commands
                            if data.startswith(b'__RESIZE__:'):
                                try:
                                    parts = data.decode().split(':')
                                    if len(parts) >= 3:
                                        r = int(parts[1])
                                        c = int(parts[2].split('__')[0])
                                        set_winsize(master, r, c)
                                except:
                                    pass
                            elif data.startswith(b'__EXIT__'):
                                cleanup()
                            else:
                                # Decode base64 input
                                try:
                                    decoded = base64.b64decode(data)
                                    os.write(master, decoded)
                                except:
                                    # Raw input
                                    os.write(master, data)
                    except:
                        pass
                
                # Read from PTY (output to WebSocket)
                if master in rlist:
                    try:
                        data = os.read(master, 4096)
                        if data:
                            encoded = base64.b64encode(data).decode('ascii')
                            msg = json.dumps({
                                "type": "terminal_output",
                                "sessionId": session_id,
                                "data": encoded,
                                "encoding": "base64"
                            })
                            print(msg, flush=True)
                        else:
                            cleanup()
                    except OSError:
                        cleanup()
                    except:
                        pass
                
                # Check if child is still alive
                try:
                    wpid, status = os.waitpid(pid, os.WNOHANG)
                    if wpid == pid:
                        cleanup()
                except:
                    pass
                    
        except KeyboardInterrupt:
            cleanup()
        finally:
            try:
                os.close(fifo_fd)
                os.unlink(fifo_path)
            except:
                pass
            os.close(master)

if __name__ == '__main__':
    main()
