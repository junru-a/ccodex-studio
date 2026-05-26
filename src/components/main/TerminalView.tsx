import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useAppStore } from '../../stores/app-store';

import '@xterm/xterm/css/xterm.css';

const i18n = {
  zh: {
    preparing: '\u6b63\u5728\u51c6\u5907\u5185\u5d4c\u7ec8\u7aef...',
    notMounted: '\u7ec8\u7aef\u5bb9\u5668\u8fd8\u6ca1\u6709\u6302\u8f7d\u3002',
    ready: '\u5185\u5d4c\u7ec8\u7aef\u5df2\u5c31\u7eea\u3002',
    selectProject: '\u8bf7\u5148\u9009\u62e9\u9879\u76ee\u3002',
    starting: '\u6b63\u5728\u542f\u52a8 Claude Code...',
    running: 'Claude Code \u6b63\u5728\u5185\u5d4c PTY \u4e2d\u8fd0\u884c\u3002',
    retryReady: '\u5185\u5d4c\u7ec8\u7aef\u8fd8\u6ca1\u51c6\u5907\u597d\uff0c\u8bf7\u518d\u70b9\u4e00\u6b21\u542f\u52a8\u3002',
    openProject: '\u6253\u5f00\u9879\u76ee',
    emptyDesc: '\u9009\u62e9\u4e00\u4e2a\u9879\u76ee\u540e\uff0c\u5c31\u53ef\u4ee5\u5728\u5185\u5d4c\u7ec8\u7aef\u91cc\u8fd0\u884c Claude Code\u3002',
    fixError: '\u4fee\u590d\u6700\u8fd1\u9519\u8bef',
    fixPrompt: '\u8bf7\u5206\u6790\u5e76\u4fee\u590d\u521a\u624d\u7ec8\u7aef\u91cc\u7684\u9519\u8bef\u3002\u8bf7\u5148\u8bf4\u660e\u6839\u56e0\uff0c\u518d\u76f4\u63a5\u4fee\u6539\u9700\u8981\u7684\u6587\u4ef6\uff0c\u6700\u540e\u544a\u8bc9\u6211\u5982\u4f55\u9a8c\u8bc1\u3002',
    errorContext: '\u9519\u8bef\u4e0a\u4e0b\u6587',
    launch: 'Launch Claude Code',
    reading: '\u9605\u8bfb\u6a21\u5f0f',
    resetDisplay: '\u91cd\u7f6e\u663e\u793a',
  },
  en: {
    preparing: 'Preparing embedded terminal...',
    notMounted: 'Terminal container is not mounted yet.',
    ready: 'Embedded terminal ready.',
    selectProject: 'Select a project before launching Claude Code.',
    starting: 'Starting Claude Code...',
    running: 'Claude Code is running in the embedded PTY.',
    retryReady: 'Embedded terminal is not ready. Try clicking Launch again.',
    openProject: 'Open Project',
    emptyDesc: 'Select a project to run Claude Code inside the embedded terminal.',
    fixError: 'Fix recent error',
    fixPrompt: 'Please analyze and fix the recent terminal error. Explain the root cause first, edit the needed files directly, then tell me how to verify.',
    errorContext: 'Error context',
    launch: 'Launch Claude Code',
    reading: 'Reading mode',
    resetDisplay: 'Reset display',
  },
};

export const TerminalView: React.FC = () => {
  const {
    currentProjectPath,
    pendingResumeSessionId,
    newSessionRequestId,
    activeProfileId,
    profiles,
    lastDetectedError,
    terminalOutput,
    language,
    clearPendingResumeSession,
    clearTerminalOutput,
    setMainView,
  } = useAppStore();

  const t = i18n[language];
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cleanupsRef = useRef<Array<() => void>>([]);
  const inputDisposeRef = useRef<{ dispose: () => void } | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastNewSessionRequestRef = useRef(0);
  const startingRef = useRef(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [terminalReady, setTerminalReady] = useState(false);
  const [terminalStatus, setTerminalStatus] = useState(t.preparing);

  useEffect(() => {
    if (!terminalReady) setTerminalStatus(t.preparing);
  }, [t.preparing, terminalReady]);

  const disposeXterm = useCallback(() => {
    inputDisposeRef.current?.dispose();
    inputDisposeRef.current = null;
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    try {
      xtermRef.current?.dispose();
    } catch {
      // Already disposed.
    }
    xtermRef.current = null;
    fitAddonRef.current = null;
    setTerminalReady(false);
    if (terminalRef.current) {
      terminalRef.current.innerHTML = '';
    }
  }, []);

  const initXterm = useCallback((force = false): Terminal | null => {
    if (force) disposeXterm();
    if (xtermRef.current) return xtermRef.current;
    if (!terminalRef.current) {
      setTerminalStatus(t.notMounted);
      return null;
    }

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      theme: {
        background: '#0b0b0b',
        foreground: '#f2f2f2',
        cursor: '#ffffff',
        selectionBackground: 'rgba(255,255,255,0.25)',
        black: '#151515',
        red: '#ff6b65',
        green: '#64d98b',
        yellow: '#e6c15d',
        blue: '#9dbdff',
        magenta: '#d8b8ff',
        cyan: '#80e6ef',
        white: '#f2f2f2',
        brightBlack: '#8e8e8e',
        brightRed: '#ff8580',
        brightGreen: '#80e6a0',
        brightYellow: '#f1d36f',
        brightBlue: '#bdd1ff',
        brightMagenta: '#e5ccff',
        brightCyan: '#a7f1f5',
        brightWhite: '#ffffff',
      },
      screenReaderMode: false,
      smoothScrollDuration: 0,
      allowProposedApi: true,
      cols: 120,
      rows: 40,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    term.open(terminalRef.current);

    terminalRef.current.addEventListener('mousedown', () => term.focus());
    terminalRef.current.addEventListener('click', () => term.focus());

    if (!inputDisposeRef.current) {
      inputDisposeRef.current = term.onData((data: string) => {
        window.ccodex.terminalInput(data);
      });
    }

    if (!resizeObserverRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
          window.ccodex.terminalResize(term.cols, term.rows);
        } catch {
          // Resize can race startup on Windows.
        }
      });
      resizeObserver.observe(terminalRef.current);
      resizeObserverRef.current = resizeObserver;
    }

    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch {
        // Ignore first-layout timing issues.
      }
      term.focus();
    }, 100);

    setTerminalReady(true);
    setTerminalStatus(t.ready);
    return term;
  }, [disposeXterm, t.notMounted, t.ready]);

  const startSession = useCallback(async (resumeSessionId?: string) => {
    if (startingRef.current) {
      return;
    }

    if (!currentProjectPath) {
      setTerminalStatus(t.selectProject);
      return;
    }

    const ensuredTerm = initXterm(true);
    if (!ensuredTerm) {
      setTerminalStatus(t.retryReady);
      return;
    }

    const term = ensuredTerm;
    startingRef.current = true;
    setTerminalStatus(t.starting);
    cleanupsRef.current.forEach((fn) => fn());
    cleanupsRef.current = [];

    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      fitAddonRef.current?.fit();
    } catch {
      // Layout may still be settling.
    }
    clearTerminalOutput();
    term.focus();
    term.write(
      resumeSessionId
        ? `\x1b[36mResuming Claude Code session ${resumeSessionId}...\x1b[0m\r\n`
        : '\x1b[36mStarting Claude Code inside embedded PTY...\x1b[0m\r\n'
    );
    term.write(`\x1b[90mCWD: ${currentProjectPath}\x1b[0m\r\n`);

    const unsubData = window.ccodex.onTerminalData((data: string) => {
      term.write(data);
      useAppStore.getState().appendTerminalOutput(data);
    });

    const unsubExit = window.ccodex.onTerminalExit((code: number) => {
      term.write(`\r\n\x1b[33m-- Claude Code exited (code ${code}) --\x1b[0m\r\n`);
      setSessionActive(false);
    });

    cleanupsRef.current = [unsubData, unsubExit];

    let result: Awaited<ReturnType<typeof window.ccodex.terminalCreate>>;
    try {
      result = await window.ccodex.terminalCreate({
        projectPath: currentProjectPath,
        profileId: activeProfileId || undefined,
        resumeSessionId,
        cols: term.cols,
        rows: term.rows,
      });
    } catch (err) {
      const message = String(err);
      setTerminalStatus(`Failed to call terminal:create: ${message}`);
      term.write(`\x1b[31mFailed to call terminal:create: ${message}\x1b[0m\r\n`);
      startingRef.current = false;
      return;
    }

    if (result.success) {
      setSessionActive(true);
      setTerminalStatus(t.running);
      term.write(`\x1b[90mPTY pid: ${result.data?.pid ?? 'unknown'}\x1b[0m\r\n\r\n`);
      setTimeout(() => term.focus(), 50);
    } else {
      const message = (result as { error?: string }).error || 'unknown error';
      setTerminalStatus(`Failed to launch Claude Code: ${message}`);
      term.write(`\x1b[31mFailed to launch Claude Code: ${message}\x1b[0m\r\n`);
    }
    startingRef.current = false;
  }, [currentProjectPath, activeProfileId, initXterm, clearTerminalOutput, t.retryReady, t.running, t.selectProject, t.starting]);

  useEffect(() => {
    if (!pendingResumeSessionId || !currentProjectPath) return;
    const sessionId = pendingResumeSessionId;
    clearPendingResumeSession();
    startSession(sessionId);
  }, [pendingResumeSessionId, currentProjectPath, clearPendingResumeSession, startSession]);

  useEffect(() => {
    if (newSessionRequestId === 0 || newSessionRequestId === lastNewSessionRequestRef.current) return;
    lastNewSessionRequestRef.current = newSessionRequestId;
    startSession();
  }, [newSessionRequestId, startSession]);

  const killSession = useCallback(async () => {
    await window.ccodex.terminalKill();
    startingRef.current = false;
    setSessionActive(false);
    cleanupsRef.current.forEach((fn) => fn());
    cleanupsRef.current = [];
  }, []);

  const resetDisplay = useCallback(() => {
    const term = initXterm(true);
    if (!term) return;
    setTimeout(() => term.focus(), 0);
  }, [initXterm]);

  useEffect(() => {
    if (!terminalRef.current) return;
    const term = initXterm();
    if (!term) return;

    const focusHandler = () => term.focus();
    terminalRef.current.addEventListener('pointerdown', focusHandler);
    terminalRef.current.addEventListener('focusin', focusHandler);
    window.addEventListener('focus', focusHandler);

    return () => {
      terminalRef.current?.removeEventListener('pointerdown', focusHandler);
      terminalRef.current?.removeEventListener('focusin', focusHandler);
      window.removeEventListener('focus', focusHandler);
      disposeXterm();
    };
  }, [disposeXterm, initXterm]);

  useEffect(() => {
    return () => {
      cleanupsRef.current.forEach((fn) => fn());
      window.ccodex.terminalKill().catch(() => {});
    };
  }, []);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  if (!currentProjectPath) {
    return (
      <div className="main-content__empty">
        <div className="main-content__empty-icon">CC</div>
        <div className="main-content__empty-title">CCodex Studio</div>
        <div className="main-content__empty-desc">{t.emptyDesc}</div>
        <div className="main-content__empty-actions">
          <button
            className="btn btn--primary"
            onClick={async () => {
              const dir = await window.ccodex.selectDirectory();
              if (dir) useAppStore.getState().setCurrentProjectPath(dir);
            }}
          >
            {t.openProject}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-shell">
      <div className="terminal-toolbar">
        <span className="terminal-toolbar__project">
          {currentProjectPath.split(/[/\\]/).pop() || currentProjectPath}
        </span>

        {sessionActive ? (
          <span className="terminal-toolbar__state terminal-toolbar__state--active">
            <span className="terminal-toolbar__dot" />
            Embedded
          </span>
        ) : (
          <span className="terminal-toolbar__state">Idle</span>
        )}

        {activeProfile && <span className="terminal-toolbar__meta">{activeProfile.name}</span>}
        <div className="terminal-toolbar__spacer" />

        {lastDetectedError && sessionActive && (
          <button
            className="btn btn--small btn--warning"
            onClick={() => {
              const excerpt = terminalOutput.slice(-1800).replace(/\r/g, '');
              window.ccodex.terminalInput(`${t.fixPrompt}\n\n${t.errorContext}:\n${excerpt}\r`);
            }}
          >
            {t.fixError}
          </button>
        )}

        {sessionActive ? (
          <button className="btn btn--small btn--danger" onClick={killSession}>
            Stop
          </button>
        ) : (
          <button className="btn btn--primary btn--small" onClick={() => startSession()}>
            {t.launch}
          </button>
        )}

        <button className="btn btn--small" onClick={resetDisplay}>
          {t.resetDisplay}
        </button>

        <button className="btn btn--small" onClick={() => setMainView('session-preview')}>
          {t.reading}
        </button>
      </div>

      {!terminalReady && <div className="terminal-status">{terminalStatus}</div>}

      <div
        ref={terminalRef}
        className="terminal-xterm"
        tabIndex={0}
        onClick={() => xtermRef.current?.focus()}
        onKeyDownCapture={() => xtermRef.current?.focus()}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(event) => {
          event.preventDefault();
          const text = event.dataTransfer.getData('text/plain');
          if (text) {
            window.ccodex.terminalInput(text);
            xtermRef.current?.focus();
          }
        }}
      />
    </div>
  );
};
