import { useEffect, useState, useRef } from "react";
import {
  advanceTransfer,
  advanceProbe,
  capability,
  connect,
  disconnect,
  effect,
  install,
  isUpgrade,
  probeCredentials,
  remote,
  scan,
  take,
  targets,
  type State,
  type File,
} from "../game/game";
import { load, save } from "../persistence";
import "./app.css";
export function App() {
  const context = useRef<HTMLElement>(null);
  const [initial] = useState(load),
    [s, set] = useState(initial.state);
  const [selected, select] = useState(
    () =>
      initial.state.credentialAttempt?.target ??
      remote(initial.state)?.id ??
      Object.keys(initial.state.known)[0],
  );
  const [warning, setWarning] = useState(initial.warning);
  useEffect(() => {
    if (!initial.warning) {
      setWarning(
        save(s)
          ? ""
          : "Storage unavailable. Keep this tab open; progress is not saved.",
      );
    }
  }, [s, initial.warning]);
  useEffect(() => {
    const timer = setInterval(
      () => set((s) => advanceTransfer(advanceProbe(s, 100), 100)),
      100,
    );
    return () => clearInterval(timer);
  }, []);
  const list = targets(s),
    t = list.find((t) => t.id === selected)!,
    r = remote(s),
    c = capability(s),
    o = t.observation;
  const act = (f: (s: State) => State) => set(f);
  function choose(id: string) {
    if (s.transfer || s.credentialAttempt) return;
    set((s) => (s.session ? disconnect(s) : s));
    select(id);
    context.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
  }
  const pending = s.local.files.filter(
    (f) =>
      !s.local.installed.some((x) => x.name === f.software.name) &&
      isUpgrade(s, f.software),
  );
  const hasLoot = r?.files.some((f) => isUpgrade(s, f.software));
  const candidates = list.filter(
    (x) =>
      x.id !== selected &&
      (!x.access || x.observation.packages?.some((p) => isUpgrade(s, p))),
  );
  const next =
    candidates.find(
      (x) => x.ready && x.observation.packages?.some((p) => isUpgrade(s, p)),
    ) ??
    candidates.find((x) => !x.observation.scanned) ??
    candidates.find(
      (x) => (x.observation.traceUsed ?? 0) < c.trace && !x.observation.name,
    ) ??
    candidates[0];
  const needScan = !o.scanned || (!o.name && (o.traceUsed ?? 0) < c.trace);
  const primary = needScan
    ? "SCAN"
    : !t.access
      ? "HACK"
      : r?.id === t.id
        ? null
        : "CONNECT";
  const security =
    o.auth === undefined
      ? "UNKNOWN"
      : o.firewall === undefined
        ? "PARTIAL"
        : o.auth === 1 && !o.firewall
          ? "LOW"
          : o.auth <= 2 && !o.firewall
            ? "MODERATE"
            : "HIGH";
  const readiness = t.access
    ? "Access retained"
    : t.ready === true
      ? "Your tools can get through"
      : t.ready === false
        ? "Upgrade needed"
        : "Outcome uncertain · attempt is free";
  function artifact(f: File) {
    const owned = s.local.files.find((x) => x.id === f.id),
      installed = s.local.installed.some((x) => x.name === f.software.name),
      useful = isUpgrade(s, f.software);
    return (
      <div className="artifact" key={f.id}>
        <div className="file-icon" aria-hidden="true">
          ↳
        </div>
        <div className="artifact-copy">
          <div className="eyebrow">
            SOFTWARE PACKAGE · {(f.bytes / 1000000).toFixed(1)} MB
          </div>
          <h3>{f.software.name}</h3>
          <p>{effect(f.software)}</p>
          <code>{owned?.path ?? f.path}</code>
        </div>
        <div className="artifact-action">
          {installed ? (
            <span className="good">✓ Installed</span>
          ) : owned && !useful ? (
            <span className="muted">Stored · stronger tool installed</span>
          ) : owned ? (
            <button
              className="primary"
              onClick={() => act((s) => install(s, f.id))}
            >
              INSTALL {f.software.name}
            </button>
          ) : (
            <button
              className="primary"
              disabled={!!s.transfer}
              onClick={() => act((s) => take(s, f.id))}
            >
              {s.transfer?.fileId === f.id
                ? "TRANSFERRING…"
                : `TAKE ${f.software.name}`}
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <main>
      <header>
        <a className="brand" href="#">
          N<span>◈</span>DE–OS <small>/ SYNTHESIS</small>
        </a>
        <div className="local">
          <i /> LOCAL WORLD <span>01</span>
        </div>
      </header>
      <div className="intro">
        <div>
          <div className="eyebrow">YOUR MACHINE. THEIR TOOLS.</div>
          <h1>
            Find a way in<span>.</span>
          </h1>
          <p>Read the signal. Break in. Take something better.</p>
        </div>
        <div className="tally">
          <strong>{s.access.length.toString().padStart(2, "0")}</strong>
          <span>
            / {list.length.toString().padStart(2, "0")}
            <br />
            DEVICES ACCESSED
          </span>
        </div>
      </div>
      {warning && (
        <p className="warning" role="alert">
          {warning}
        </p>
      )}
      <div className="workspace">
        <aside className="signals" aria-label="Known signals">
          <div className="panel-title">
            <span>01 / KNOWN SPACE</span>
            <b>{list.length} SIGNALS</b>
          </div>
          <p className="hint">
            Reachable file services. Scan to learn what’s inside.
          </p>
          <div className="signal-list">
            {list.map((x, i) => {
              const useful = x.observation.packages?.some((p) =>
                isUpgrade(s, p),
              );
              return (
                <button
                  className={`signal ${selected === x.id ? "selected" : ""}`}
                  disabled={
                    !!(s.transfer || s.credentialAttempt) && x.id !== selected
                  }
                  aria-pressed={selected === x.id}
                  aria-label={x.label}
                  key={x.id}
                  onClick={() => choose(x.id)}
                >
                  <span className="signal-index">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{x.label}</strong>
                    <small>
                      {x.access
                        ? useful
                          ? "ACCESS · USEFUL LOOT"
                          : "ACCESS RETAINED"
                        : x.ready === true
                          ? "READY TO HACK"
                          : x.ready === false
                            ? "UPGRADE NEEDED"
                            : x.observation.scanned
                              ? "MASKED · REACHABLE"
                              : "UNSCANNED"}
                    </small>
                  </span>
                  <span
                    className={x.access ? "good" : "muted"}
                    aria-hidden="true"
                  >
                    {x.access ? "✓" : "↗"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="legend">
            <i /> Signals are local simulation devices.
            <br />
            Nothing connects to real machines.
          </div>
        </aside>
        <section ref={context} className="target" aria-label="Target context">
          <div className="panel-title">
            <span>02 / TARGET CONTEXT</span>
            <b>
              {r?.id === t.id
                ? "SESSION ACTIVE"
                : t.access
                  ? "ACCESS ESTABLISHED"
                  : "FILE SERVICE"}
            </b>
          </div>
          <div className="target-body">
            <div className="target-heading">
              <div>
                <div className="eyebrow">
                  {o.name
                    ? "IDENTITY OBSERVED"
                    : o.scanned
                      ? "IDENTITY MASKED"
                      : "IDENTITY UNKNOWN"}
                </div>
                <h2>{t.label}</h2>
                <p>
                  {o.role ??
                    "A reachable machine. Its identity and contents are not yet known."}
                </p>
              </div>
              <span className="target-symbol" aria-hidden="true">
                ⌘
              </span>
            </div>
            <div className="facts">
              <div>
                <span>PROTECTION</span>
                <strong>{security}</strong>
                <small>
                  {o.auth !== undefined
                    ? `KeyProbe ${o.auth} challenge`
                    : "Scan for evidence"}
                </small>
              </div>
              <div>
                <span>PACKET FILTER</span>
                <strong>
                  {o.firewall === undefined
                    ? "UNKNOWN"
                    : o.firewall
                      ? "ACTIVE"
                      : "NONE"}
                </strong>
                <small>
                  {o.firewall
                    ? c.tunnel
                      ? "Tunnel installed"
                      : "Tunnel required"
                    : o.firewall === false
                      ? "Direct route observed"
                      : "Not yet observed"}
                </small>
              </div>
            </div>
            {o.signal && (
              <div className="manifest">
                <span className="eyebrow">OBSERVED PACKAGE MANIFEST</span>
                <p>{o.signal}</p>
              </div>
            )}
            <div className="action-row">
              {primary && (
                <button
                  className="primary main-action"
                  disabled={!!s.credentialAttempt}
                  onClick={() =>
                    act((s) =>
                      primary === "SCAN"
                        ? scan(s, t.id)
                        : primary === "HACK"
                          ? probeCredentials(s, t.id)
                          : connect(s, t.id),
                    )
                  }
                >
                  {s.credentialAttempt ? "TESTING…" : primary}{" "}
                  <span aria-hidden="true">→</span>
                </button>
              )}
              {primary === "SCAN" && !t.access && (
                <button
                  className="quiet"
                  disabled={!!s.credentialAttempt}
                  onClick={() => act((s) => probeCredentials(s, t.id))}
                >
                  HACK without scan
                </button>
              )}
              {primary !== "SCAN" && !r && (
                <button
                  className="quiet"
                  disabled={!!s.credentialAttempt}
                  onClick={() => act((s) => scan(s, t.id))}
                >
                  SCAN again
                </button>
              )}
              {r?.id === t.id && (
                <button className="quiet" onClick={() => act(disconnect)}>
                  Disconnect{s.transfer ? " · cancels transfer" : ""}
                </button>
              )}
              <small className={t.ready ? "good" : "muted"}>{readiness}</small>
            </div>
            <div className="feedback" role="status">
              <span aria-hidden="true">›</span>
              {s.messageTarget && s.messageTarget !== selected
                ? "Investigate this signal to choose your next move."
                : s.message}
            </div>
            {s.credentialAttempt?.target === selected && (
              <div className="intrusion">
                <div>
                  <span>KEYPROBE {s.credentialAttempt.tool.probe}</span>
                  <b>AUTHENTICATION ATTEMPT</b>
                </div>
                <progress
                  aria-label="Authentication progress"
                  value={s.credentialAttempt.work}
                  max={s.credentialAttempt.required}
                />
                <p>Testing the file service. No access has been granted yet.</p>
              </div>
            )}
            {t.access &&
              !r &&
              s.message.startsWith("ACCESS GRANTED") &&
              s.messageTarget === selected && (
                <div className="access-reward">
                  <span className="unlock-mark" aria-hidden="true">
                    ⌁
                  </span>
                  <div>
                    <div className="eyebrow">INTRUSION SUCCESSFUL</div>
                    <h3>You're in.</h3>
                    <p>
                      Access is yours to keep. Connect and take their tools.
                    </p>
                  </div>
                </div>
              )}
            {s.upgrade &&
              s.message.startsWith(s.upgrade.name + " installed.") && (
                <div className="upgrade-reward" key={s.upgrade.id}>
                  <div className="eyebrow">YOUR MACHINE JUST GOT STRONGER</div>
                  <h3>{s.upgrade.name} installed</h3>
                  <div className="upgrade-deltas">
                    {s.upgrade.before.probe !== s.upgrade.after.probe && (
                      <span>
                        ACCESS{" "}
                        <b>
                          {s.upgrade.before.probe} → {s.upgrade.after.probe}
                        </b>
                      </span>
                    )}
                    {s.upgrade.before.trace !== s.upgrade.after.trace && (
                      <span>
                        RECON{" "}
                        <b>
                          {s.upgrade.before.trace} → {s.upgrade.after.trace}
                        </b>
                      </span>
                    )}
                    {s.upgrade.before.tunnel !== s.upgrade.after.tunnel && (
                      <span>
                        ROUTING <b>Direct → Tunnel</b>
                      </span>
                    )}
                    {s.upgrade.before.rate !== s.upgrade.after.rate && (
                      <span>
                        TRANSFER{" "}
                        <b>
                          {s.upgrade.before.rate / 1000000} →{" "}
                          {s.upgrade.after.rate / 1000000} MB/s
                        </b>
                      </span>
                    )}
                  </div>
                </div>
              )}
            {r?.id === t.id && (
              <section className="remote" data-firmware={r.firmware.family}>
                <div className="firmware-bar">
                  <div className="machine-drawing" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div>
                    <div className="eyebrow">REMOTE DEVICE / {r.model}</div>
                    <h3>
                      {r.firmware.name} <small>{r.firmware.version}</small>
                    </h3>
                    <p>{r.name}</p>
                  </div>
                  <span className="session-badge">CONNECTED</span>
                </div>
                <div className="section-line">
                  <h3>Remote files</h3>
                  <code>
                    {r.files[0]?.path.slice(
                      0,
                      r.files[0].path.lastIndexOf("/"),
                    )}
                  </code>
                </div>
                {r.files.map(artifact)}
                {s.transfer && (
                  <div className="transfer">
                    <progress
                      aria-label="File transfer"
                      value={s.transfer.bytes}
                      max={s.transfer.total}
                    />
                    <small>
                      {(s.transfer.bytes / 1000000).toFixed(1)} /{" "}
                      {(s.transfer.total / 1000000).toFixed(1)} MB →
                      node-01/downloads
                    </small>
                  </div>
                )}
              </section>
            )}
            {t.access && r?.id === t.id && !hasLoot && next && (
              <div className="next">
                <div>
                  <span className="eyebrow">KEEP GOING</span>
                  <p>
                    {next.ready
                      ? "Your tools can enter another machine."
                      : "Another signal is waiting to be investigated."}
                  </p>
                </div>
                <button onClick={() => choose(next.id)}>
                  Explore {next.label} →
                </button>
              </div>
            )}
            {s.access.length === list.length && (
              <p className="completion">
                Every device accessed. Your toolkit owns this pocket of the
                network. Remaining packages are yours to collect.
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="loadout">
        <div>
          <div className="eyebrow">
            03 / {s.local.id.toUpperCase()} · {s.local.firmware.name}{" "}
            {s.local.firmware.version} · {s.local.model}
          </div>
          <h2>Built from what you take.</h2>
        </div>
        <div className="tools">
          <div>
            <small>ACCESS</small>
            <strong>KeyProbe {c.probe}</strong>
          </div>
          <div>
            <small>RECON</small>
            <strong>NodeScan {c.trace}</strong>
          </div>
          <div>
            <small>ROUTING</small>
            <strong>{c.tunnel ? "Tunnel" : "Direct"}</strong>
          </div>
          <div>
            <small>TRANSFER</small>
            <strong>{(c.rate / 1000000).toFixed(1)} MB/s</strong>
          </div>
        </div>
      </section>
      {pending
        .filter((f) => !r?.files.some((x) => x.id === f.id))
        .map(artifact)}
      {s.local.files.length > 0 && (
        <details className="downloads">
          <summary>
            My files · {s.local.files.length} packages in /downloads
          </summary>
          {s.local.files.map((f) => (
            <div key={f.id}>
              <code>{f.path}</code>
              <span>
                {s.local.installed.some((x) => x.name === f.software.name)
                  ? "Installed"
                  : "Stored"}
              </span>
            </div>
          ))}
        </details>
      )}
      <footer>
        <span>SYNTHESIS / PLAYABLE LOOP</span>
        <span>
          {warning ? "SAVING PAUSED" : "PROGRESS SAVED ON THIS BROWSER"}
        </span>
      </footer>
    </main>
  );
}
