const ShieldIcon = () => <span aria-hidden="true">◇</span>;

const features = [
  {
    icon: "01",
    title: "Device attestation",
    text: "Bind every session to Meta Device Application Integrity, platform identity, and a server-issued nonce.",
  },
  {
    icon: "02",
    title: "Build allowlisting",
    text: "Validate APK signatures, APK hashes, and OBB assets against builds registered from your Unity pipeline.",
  },
  {
    icon: "03",
    title: "Runtime integrity",
    text: "Detect root, debuggers, emulators, and Frida, Xposed, Substrate, Zygisk, and Riru hook frameworks.",
  },
  {
    icon: "04",
    title: "Replay-resistant sessions",
    text: "Short-lived nonces carry attestation, identity, build evidence, and integrity state to the backend.",
  },
  {
    icon: "05",
    title: "Account + hardware bans",
    text: "Enforce server-side decisions against Oculus identities, org-scoped IDs, and Widevine device IDs.",
  },
  {
    icon: "06",
    title: "Unity-native workflow",
    text: "Ship with editor build checks, CI/CD hooks, a dedicated-server validator, and Photon custom authentication.",
  },
];

export default function Home() {
  return (
    <main>
      <header className="topnav">
        <div className="container nav-inner">
          <a className="brand" href="#top" aria-label="Vintex home">
            <span className="brand-mark" aria-hidden="true"><i /><i /></span>
            <span>vintex<span className="accent">.gg</span></span>
          </a>
          <nav className="nav-links" aria-label="Main navigation">
            <a href="#features">Protection</a>
            <a href="#workflow">Integration</a>
            <a href="#sdk">Unity SDK</a>
            <a className="btn btn-sm" href="/dashboard">Dashboard</a>
          </nav>
        </div>
      </header>

      <section className="hero container" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> Android anticheat for Unity</div>
          <h1>Trust the player.<br /><span className="grad">Verify the device.</span></h1>
          <p>
            Vintex is a fail-closed integrity and attestation layer for Android Unity games.
            It validates the build, runtime, platform identity, and session before a player reaches gameplay.
          </p>
          <div className="cta">
            <a className="btn btn-primary btn-lg" href="#workflow">See the integration <span aria-hidden="true">→</span></a>
            <a className="btn btn-lg" href="#features">Explore protection</a>
          </div>
          <div className="hero-badges" aria-label="Supported technology">
            <span>Unity</span><span>Android ARM64</span><span>Meta Quest</span><span>Photon</span>
          </div>
        </div>

        <div className="terminal-wrap" aria-label="Vintex validation console example">
          <div className="term-glow" />
          <div className="terminal">
            <div className="term-head">
              <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
              <span>vintex validation pipeline</span>
            </div>
            <div className="term-body">
              <div><b>$</b> vintex verify --platform quest</div>
              <div className="spacer-line" />
              <div><em>01</em> platform identity <strong>verified</strong></div>
              <div><em>02</em> device attestation <strong>verified</strong></div>
              <div><em>03</em> apk + obb allowlist <strong>matched</strong></div>
              <div><em>04</em> runtime integrity <strong>clean</strong></div>
              <div><em>05</em> session nonce <strong>bound</strong></div>
              <div className="spacer-line" />
              <div className="term-result">VERDICT: ALLOW <span className="cursor">▮</span></div>
            </div>
          </div>
          <div className="metric-strip">
            <div><strong>2</strong><span>independent gates</span></div>
            <div><strong>45s</strong><span>nonce lifetime</span></div>
            <div><strong>ARM64</strong><span>native core</span></div>
          </div>
        </div>
      </section>

      <section className="section container" id="features">
        <div className="section-head">
          <div className="eyebrow">Protection stack</div>
          <h2>Every signal. One verdict.</h2>
          <p>Layered client evidence meets a server-authoritative decision before the session is admitted.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature" key={feature.title}>
              <div className="feature-number">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
        <p className="security-note"><ShieldIcon /> No client-side protection is absolute. Vintex raises the cost of tampering and keeps the final allow, kick, or ban decision on your server.</p>
      </section>

      <section className="architecture" id="architecture">
        <div className="container architecture-grid">
          <div>
            <div className="eyebrow">Fail-closed by design</div>
            <h2>Unverified means denied.</h2>
            <p>Vintex requires both the native self-check and backend validation to pass. Missing credentials, invalid attestation, stale sessions, altered builds, and unreachable validation all deny in production.</p>
            <ul className="check-list">
              <li><span>✓</span> Server-authoritative allow, kick, and ban verdicts</li>
              <li><span>✓</span> Nonce-bound attestation with anti-replay checks</li>
              <li><span>✓</span> Optional mTLS and constant-time token validation</li>
              <li><span>✓</span> Per-IP API rate limiting</li>
            </ul>
          </div>
          <div className="flow-card">
            <div className="flow-label">request path</div>
            <div className="flow-node"><span>01</span><div><b>Unity client</b><small>collect signed device evidence</small></div></div>
            <i className="flow-line" />
            <div className="flow-node"><span>02</span><div><b>Vintex backend</b><small>verify identity, build + runtime</small></div></div>
            <i className="flow-line" />
            <div className="flow-node active"><span>03</span><div><b>Game server</b><small>enforce authoritative verdict</small></div></div>
          </div>
        </div>
      </section>

      <section className="section container" id="workflow">
        <div className="section-head">
          <div className="eyebrow">Built for your pipeline</div>
          <h2>From package to protected build.</h2>
          <p>Integrate the SDK, register the artifact, and gate gameplay on a valid Vintex response.</p>
        </div>
        <div className="steps">
          <article><span>1</span><div><h3>Install the Unity SDK</h3><p>Add the BankruptGames package and attach <code>VintexGamePlugin</code> to your bootstrap scene.</p></div></article>
          <article><span>2</span><div><h3>Register your build</h3><p>Editor and CI hooks submit signing, APK, and OBB evidence before release.</p></div></article>
          <article><span>3</span><div><h3>Gate the session</h3><p>Admit gameplay only after the dedicated server or Photon auth receives an allow verdict.</p></div></article>
        </div>
      </section>

      <section className="section sdk-section" id="sdk">
        <div className="container sdk-grid">
          <div className="sdk-copy">
            <div className="eyebrow">Unity package</div>
            <h2>Install Vintex in your project.</h2>
            <p>The UPM-ready download includes the runtime SDK, themed editor setup, CI build hooks, Photon support, and the Android ARM64 native core.</p>
            <div className="sdk-actions">
              <a className="btn btn-primary btn-lg" href="/downloads/vintex-unity-sdk-1.1.0-beta.3.zip" download>Download SDK <span aria-hidden="true">↓</span></a>
              <span>v1.1.0-beta.3 · Unity 2021.3+</span>
            </div>
            <p className="sdk-warning"><span>Beta</span> The clean-room native attestation and OBB implementation is still being validated. Test on real Quest hardware before a production release.</p>
          </div>
          <div className="sdk-install-card">
            <div className="sdk-card-head"><span>QUICK INSTALL</span><b>com.bankruptgames.vintex</b></div>
            <ol>
              <li><span>01</span><p>Download and extract the archive.</p></li>
              <li><span>02</span><p>Open <b>Window → Package Manager</b> in Unity.</p></li>
              <li><span>03</span><p>Choose <b>+ → Add package from disk</b>.</p></li>
              <li><span>04</span><p>Select the extracted <code>package.json</code>.</p></li>
            </ol>
            <div className="sdk-card-foot"><i /> SHA-256 published in the dashboard</div>
          </div>
        </div>
      </section>

      <section className="final-cta container">
        <div>
          <div className="eyebrow">BankruptGames security</div>
          <h2>Ship the game.<br /><span className="accent">Not the exploit surface.</span></h2>
          <p>Vintex gives Android Unity teams a practical, layered integrity gate built for real game infrastructure.</p>
        </div>
        <a className="btn btn-primary btn-lg" href="/dashboard">Open dashboard <span aria-hidden="true">→</span></a>
      </section>

      <footer>
        <div className="container footer-inner">
          <a className="brand" href="#top"><span className="brand-mark small" aria-hidden="true"><i /><i /></span><span>vintex<span className="accent">.gg</span></span></a>
          <span>Android anticheat by <b>BankruptGames</b></span>
          <span>© 2026 BankruptGames</span>
        </div>
      </footer>
    </main>
  );
}
