#!/usr/bin/env python3
"""
PTY Proxy for NBM Cloud Agent
Creates a real pseudo-terminal for interactive shell sessions
"""

import os
import sys
import pty
import select
import signal
import json
import struct
import fcntl
import termios
import subprocess

def set_window_size(fd, rows, cols):
    """Set the window size of the PTY"""
    winsize = struct.pack('HHHH', rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

def main():
    if len(sys.argv) < 2:
        print("Usage: pty-proxy.py <session_id> [rows] [cols]", file=sys.stderr)
        sys.exit(1)
    
    session_id = sys.argv[1]
    rows = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    cols = int(sys.argv[3]) if len(sys.argv) > 3 else 80
    
    master_fd, slave_fd = pty.openpty()
    set_window_size(master_fd, rows, cols)
    
    pid = os.fork()
    
    if pid == 0:
        os.close(master_fd)
        os.setsid()
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        if slave_fd > 2:
            os.close(slave_fd)
        env = os.environ.copy()
        env['TERM'] = 'xterm-256color'
        env['SHELL'] = '/bin/bash'
        os.execvpe('/bin/bash', ['/bin/bash', '--login'], env)
    else:
        os.close(slave_fd)
        fl = fcntl.fcntl(sys.stdin.fileno(), fcntl.F_GETFL)
        fcntl.fcntl(sys.stdin.fileno(), fcntl.F_SETFL, fl | os.O_NONBLOCK)
        fl = fcntl.fcntl(master_fd, fcntl.F_GETFL)
        fcntl.fcntl(master_fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)
        
        def handle_sigchld(signum, frame):
            try:
                wpid, status = os.waitpid(pid, os.WNOHANG)
                if wpid == pid:
                    sys.exit(0)
            except:
                pass
        
        signal.signal(signal.SIGCHLD, handle_sigchld)
        
        try:
            while True:
                try:
                    rlist, _, _ = select.select([sys.stdin, master_fd], [], [], 0.1)
                except select.error:
                    continue
                
                if sys.stdin in rlist:
                    try:
                        data = sys.stdin.buffer.read(4096)
                        if data:
                            if data.startswith(b'__RESIZE__:'):
                                try:
                                    parts = data.decode('utf-8').split(':')
                                    if len(parts) >= 3:
                                        r = int(parts[1])
                                        c = int(parts[2].split('__')[0])
                                        set_window_size(master_fd, r, c)
                                except:
                                    pass
                            elif data.startswith(b'__EXIT__'):
                                os.kill(pid, signal.SIGTERM)
                                break
                            else:
                                os.write(master_fd, data)
                        else:
                            break
                    except (BlockingIOError, IOError):
                        pass
                
                if master_fd in rlist:
                    try:
                        data = os.read(master_fd, 4096)
                        if data:
                            sys.stdout.buffer.write(data)
                            sys.stdout.buffer.flush()
                        else:
                            break
                    except (BlockingIOError, IOError):
                        pass
                    except OSError:
                        break
        
        except KeyboardInterrupt:
            pass
        finally:
            try:
                os.kill(pid, signal.SIGTERM)
                os.waitpid(pid, 0)
            except:
                pass
            os.close(master_fd)

if __name__ == '__main__':
    main()
