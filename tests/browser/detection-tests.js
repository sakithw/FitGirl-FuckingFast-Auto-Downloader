export async function runDetectionTests({ test, assert, fixture }) {
  const host = globalThis.FFAD.fuckingFast;
  const { watchForCandidate } = globalThis.FFAD;
  const page = "https://fuckingfast.co/abc123";
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function mounted(name, run) {
    const root = await fixture(name);
    document.body.append(root);
    try { await run(root); } finally { root.remove(); }
  }
  async function observedControl() {
    return (await fixture("observed-valid")).querySelector("[hx-post]").cloneNode(true);
  }

  await test("host allowlist rejects credentials, ports, lookalikes, and insecure schemes", () => {
    for (const value of ["http://fuckingfast.co/abc123", "https://www.fuckingfast.co/abc123",
      "https://fuckingfast.co.evil.invalid/abc123", "https://fuckingfast.co./abc123",
      "https://user:password@fuckingfast.co/abc123", "https://fuckingfast.co:8443/abc123",
      "https://evil.invalid/?next=https://fuckingfast.co/abc123", "javascript:alert(1)", "not a URL"]) {
      assert(!host.isSupportedUrl(value), "An unsupported or spoofed host was accepted");
    }
    assert(host.supportedHostnames.length === 1 && host.supportedHostnames[0] === "fuckingfast.co",
      "The supported hostname allowlist widened");
  });

  await test("pathname file IDs work with optional query and filename fragments", () => {
    for (const value of [page, `${page}#example.rar`, `${page}?source=fixture`, `${page}?source=fixture#example.rar`]) {
      assert(host.parseFilePageUrl(value)?.fileId === "abc123", "Supported URL lost its pathname file ID");
    }
    assert(host.parseFilePageUrl(`${page}#different-id`)?.fileId === "abc123", "Fragment replaced the pathname ID");
  });

  await test("file-page parser rejects non-file routes and encoded separators", () => {
    for (const suffix of ["/", "/abc123/", "/f/abc123", "/abc123/extra", "/abc%2F123", "/abc%20def"]) {
      assert(host.parseFilePageUrl(`https://fuckingfast.co${suffix}`) === null, "Unsupported file route was accepted");
    }
  });

  await test("valid control detection accepts all supported URL forms", async () => {
    await mounted("observed-valid", async (root) => {
      for (const value of [page, `${page}#example.rar`, `${page}?source=fixture`, `${page}?source=fixture#example.rar`]) {
        const result = host.detectDownloadControl(root, value);
        assert(result.status === "candidate" && result.count === 1 && result.element.tagName === "A",
          "Verified control was not found for a supported URL form");
      }
    });
  });

  await test("download control must match the current pathname file ID", async () => {
    await mounted("observed-valid", async (root) => {
      assert(host.detectDownloadControl(root, "https://fuckingfast.co/other456#example.rar").status === "invalid",
        "Control was accepted for another file ID");
      assert(host.detectDownloadControl(root, page).status === "candidate", "Returning to original path lost valid detection");
    });
    await mounted("observed-wrong-id", async (root) => {
      assert(host.detectDownloadControl(root, page).reason === "wrong-file-id", "Mismatched POST ID was accepted");
    });
  });

  await test("POST endpoints reject absolute, cross-origin, query, and malformed destinations", async () => {
    await mounted("observed-valid", async (root) => {
      const control = root.querySelector("[hx-post]");
      for (const endpoint of ["https://fuckingfast.co/f/abc123/go", "https://evil.invalid/f/abc123/go",
        "//evil.invalid/f/abc123/go", "/f/abc123/go?token=fixture", "/f/abc123/go#fragment",
        "/f/abc123/go/", "/f/abc123/start", "/f/abc123%2Fother/go"]) {
        control.setAttribute("hx-post", endpoint);
        assert(host.detectDownloadControl(root, page).status === "invalid", "Unverified POST endpoint was accepted");
      }
    });
  });

  await test("control attributes, exact text, and anchor type are required", async () => {
    await mounted("observed-valid", async (root) => {
      const original = root.querySelector("[hx-post]");
      for (const modify of [
        (control) => control.classList.remove("gay-button"),
        (control) => control.setAttribute("hx-swap", "outerHTML"),
        (control) => control.removeAttribute("rel"),
        (control) => control.setAttribute("href", "https://ads.invalid/offer"),
        (control) => { control.textContent = "DOWNLOAD NOW"; }
      ]) {
        const control = original.cloneNode(true);
        original.replaceWith(control);
        modify(control);
        assert(host.detectDownloadControl(root, page).status === "invalid", "Changed control was accepted");
        control.replaceWith(original);
      }
      const button = document.createElement("button");
      for (const attribute of original.attributes) button.setAttribute(attribute.name, attribute.value);
      button.textContent = "DOWNLOAD";
      original.replaceWith(button);
      assert(host.detectDownloadControl(root, page).reason === "wrong-element-type", "Unverified button type was accepted");
    });
  });

  await test("absent controls and synthetic error pages stay missing", async () => {
    for (const name of ["observed-missing", "synthetic-error"]) {
      await mounted(name, async (root) => {
        const result = host.detectDownloadControl(root, page);
        assert(result.status === "missing" && result.element === null, "Missing control produced a candidate");
      });
    }
  });

  await test("multiple verified controls stop detection as ambiguous", async () => {
    await mounted("observed-ambiguous", async (root) => {
      const result = host.detectDownloadControl(root, page);
      assert(result.status === "ambiguous" && result.count === 2 && result.element === null,
        "Duplicate verified controls were reduced to an arbitrary candidate");
    });
  });

  await test("hidden lookalikes and ordinary advertisement links are never selected", async () => {
    await mounted("observed-hidden-ad", async (root) => {
      let clicks = 0;
      root.addEventListener("click", () => { clicks += 1; });
      const result = host.detectDownloadControl(root, page);
      assert(result.status === "candidate" && result.count === 1 && result.invalidCount === 1,
        "Hidden control or advertisement changed valid selection");
      assert(result.element === root.querySelectorAll("[hx-post]")[1] && clicks === 0,
        "Detection selected an advertisement or activated a control");
    });
  });

  await test("disabled countdown controls remain inactive", async () => {
    await mounted("synthetic-countdown", async (root) => {
      assert(host.detectDownloadControl(root, page).reason === "disabled", "Synthetic countdown was accepted");
      const control = root.querySelector("[hx-post]");
      control.removeAttribute("aria-disabled");
      control.setAttribute("disabled", "");
      assert(host.detectDownloadControl(root, page).reason === "disabled", "Disabled attribute was ignored");
    });
  });

  await test("ancestor visibility and inert state exclude download controls", async () => {
    await mounted("observed-valid", async (root) => {
      for (const [attribute, value] of [["hidden", ""], ["inert", ""], ["aria-hidden", "true"],
        ["style", "visibility:hidden"], ["style", "opacity:0"], ["style", "display:none"]]) {
        root.setAttribute(attribute, value);
        assert(host.detectDownloadControl(root, page).reason === "hidden", "Hidden ancestor left an active candidate");
        root.removeAttribute(attribute);
      }
    });
  });

  await test("detached controls cannot be considered visible candidates", async () => {
    const root = await fixture("observed-valid");
    assert(host.detectDownloadControl(root, page).reason === "hidden", "Detached fixture became a candidate");
  });

  await test("generic fixture selectors remain opt-in and separate from production", async () => {
    await mounted("supported", async (root) => {
      assert(host.detectCandidate(root).status === "unverified", "Generic selector was enabled implicitly");
      assert(host.detectCandidate(root, '[data-ffad-fixture-control="download"]').status === "candidate",
        "Explicit test selector stopped working");
      assert(host.detectDownloadControl(root, page).status !== "candidate", "Synthetic marker activated production detection");
    });
  });

  await test("expected filename comes from visible page evidence with optional matching fragment", async () => {
    await mounted("observed-valid", async (root) => {
      assert(host.expectedFilename(root, page) === "example.rar", "Fragment-free page lost title evidence");
      assert(host.expectedFilename(root, `${page}#example.rar`) === "example.rar", "Matching fragment lost title evidence");
      assert(host.expectedFilename(root, `${page}#other.rar`) === null, "Conflicting fragment was accepted as evidence");
      assert(host.expectedFilename(root, `${page}#%ZZ`) === null, "Malformed fragment was accepted");
    });
  });

  await test("filename evidence requires one visible heading before the verified control", async () => {
    await mounted("observed-valid", async (root) => {
      const heading = root.querySelector("h1");
      root.prepend(heading);
      assert(host.expectedFilename(root, page) === "example.rar", "Wrapper-dependent title requirement returned");
      root.append(heading);
      assert(host.expectedFilename(root, page) === null, "Heading after the control was accepted");
      root.prepend(heading);
      root.append(heading.cloneNode(true));
      assert(host.expectedFilename(root, page) === null, "Multiple headings were silently reduced to one");
    });
  });

  await test("filename normalization compares basenames without hiding renames or unsafe paths", () => {
    assert(host.normalizeFilename("C:\\Downloads\\file.rar", true) === "file.rar", "Windows basename was not extracted");
    assert(host.normalizeFilename("/downloads/file.rar", true) === "file.rar", "POSIX basename was not extracted");
    assert(host.normalizeFilename("file (1).rar") !== host.normalizeFilename("file.rar"), "Collision suffix was erased");
    assert(host.normalizeFilename("FILE.rar") !== host.normalizeFilename("file.rar"), "Case-distinct names were conflated");
    for (const value of ["../file.rar", "folder\\file.rar", "", "..", "bad\u0000name.rar"]) {
      assert(host.normalizeFilename(value) === null, "Unsafe page filename was accepted");
    }
  });

  await test("observer detects a dynamically inserted verified control once", async () => {
    await mounted("observed-dynamic", async (root) => {
      const results = [];
      const disconnect = watchForCandidate(root, () => host.detectDownloadControl(root, page),
        (result) => results.push(result.status), { debounceMs: 5, timeoutMs: 100 });
      root.querySelector("#observed-slot").append(await observedControl());
      await delay(15);
      root.setAttribute("class", "changed-after-resolution");
      await delay(15);
      assert(results.join(",") === "missing,candidate", "Dynamic detection repeated after cleanup");
      disconnect();
    });
  });

  await test("rapid DOM mutations are debounced into one observer recheck", async () => {
    await mounted("observed-dynamic", async (root) => {
      let checks = 0;
      const disconnect = watchForCandidate(root, () => { checks += 1; return host.detectDownloadControl(root, page); },
        () => {}, { debounceMs: 10, timeoutMs: 100, stopOnCandidate: false });
      for (let count = 0; count < 20; count += 1) root.setAttribute("class", `change-${count}`);
      await delay(25);
      assert(checks === 2, "Rapid mutations caused excessive detector calls");
      disconnect();
    });
  });

  await test("observer timeout disconnects future DOM checks", async () => {
    await mounted("observed-dynamic", async (root) => {
      let checks = 0;
      const lifecycle = [];
      watchForCandidate(root, () => { checks += 1; return host.detectDownloadControl(root, page); }, () => {},
        { debounceMs: 5, timeoutMs: 15, onActivity: (event) => lifecycle.push(event) });
      await delay(25);
      root.querySelector("#observed-slot").append(await observedControl());
      await delay(15);
      assert(checks === 1 && lifecycle.join(",") === "started,timeout", "Observer remained active after its deadline");
    });
  });

  await test("manual observer cleanup cancels both recheck and deadline timers", async () => {
    await mounted("observed-dynamic", async (root) => {
      let checks = 0;
      const lifecycle = [];
      const disconnect = watchForCandidate(root, () => { checks += 1; return host.detectDownloadControl(root, page); },
        () => {}, { debounceMs: 15, timeoutMs: 30, onActivity: (event) => lifecycle.push(event) });
      root.setAttribute("class", "pending-recheck");
      await delay(0);
      disconnect();
      disconnect();
      await delay(40);
      assert(checks === 1 && lifecycle.join(",") === "started,manual", "Cleanup left timers or duplicate lifecycle events");
    });
  });

  await test("observer rejects missing detector and unbounded timing options", async () => {
    const root = await fixture("observed-dynamic");
    for (const [detector, options] of [[null, {}], [() => ({}), { timeoutMs: Infinity }],
      [() => ({}), { debounceMs: -1 }], [() => ({}), { timeoutMs: 0 }]]) {
      let rejected = false;
      try { watchForCandidate(root, detector, () => {}, options); } catch { rejected = true; }
      assert(rejected, "Invalid observer configuration was not rejected");
    }
  });
}
