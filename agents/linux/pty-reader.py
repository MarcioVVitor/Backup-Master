#!/usr/bin/env python3
"""
PTY Output Reader for NBM Cloud Agent
Reads from FIFO and outputs JSON messages for WebSocket relay
"""

import sys
import os
import base64
import json
import select
import fcntl

def main():
    if len(sys.argv) < 3:
        print("Usage: pty-reader.py <fifo_path> <session_id>", file=sys.stderr)
        sys.exit(1)
    
    fifo_path = sys.argv[1]
    session_id = sys.argv[2]
    
    try:
        fd = os.open(fifo_path, os.O_RDONLY)
        
        fl = fcntl.fcntl(fd, fcntl.F_GETFL)
        fcntl.fcntl(fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)
    except OSError as e:
        print(f"Failed to open FIFO: {e}", file=sys.stderr)
        sys.exit(1)
    
    try:
        while True:
            readable, _, _ = select.select([fd], [], [], 1.0)
            
            if readable:
                try:
                    data = os.read(fd, 4096)
                    if not data:
                        break
                    
                    encoded = base64.b64encode(data).decode('ascii')
                    msg = json.dumps({
                        "type": "terminal_output",
                        "sessionId": session_id,
                        "data": encoded,
                        "encoding": "base64"
                    })
                    print(msg, flush=True)
                    
                except BlockingIOError:
                    pass
                except OSError:
                    break
    finally:
        os.close(fd)
        msg = json.dumps({
            "type": "shell_closed",
            "sessionId": session_id
        })
        print(msg, flush=True)

if __name__ == '__main__':
    main()
