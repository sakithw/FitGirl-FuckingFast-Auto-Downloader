const { isSupportedUrl, detectCandidate } = globalThis.FFAD.fuckingFast;
const { watchForCandidate } = globalThis.FFAD;
const fixtureSelector = '[data-ffad-fixture-control="download"]';
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function test(name, run) {
  try {
    await run();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

async function fixture(name) {
  const response = await fetch(`../fixtures/${name}.html`);
  assert(response.ok, `Cannot load ${name} fixture`);
  const template = document.createElement("template");
  template.innerHTML = await response.text();
  return template.content;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await test("exact HTTPS host is supported", () => {
  assert(isSupportedUrl("https://fuckingfast.co/f/example"), "Expected supported host");
  assert(isSupportedUrl("https://FUCKINGFAST.CO/"), "Hostnames should be case insensitive");
});

await test("host spoofing and other schemes are rejected", () => {
  for (const url of [
    "http://fuckingfast.co/f/example",
    "https://www.fuckingfast.co/f/example",
    "https://fuckingfast.co.evil.invalid/f/example",
    "https://evil.invalid/fuckingfast.co",
    "https://fuckingfast.co@evil.invalid/f/example",
    "https://user@fuckingfast.co/f/example",
    "https://fuckingfast.co:8443/f/example",
    "not a URL"
  ]) {
    assert(!isSupportedUrl(url), `Unexpected supported URL: ${url}`);
  }
});

await test("production selector remains inactive", async () => {
  const root = await fixture("supported");
  const result = detectCandidate(root);
  assert(result.status === "unverified" && result.element === null, "Production must stay unverified");
});

await test("fixture candidate excludes an advertisement", async () => {
  const root = await fixture("supported");
  const result = detectCandidate(root, fixtureSelector);
  assert(result.status === "candidate" && result.count === 1, "Expected one fixture candidate");
  assert(result.element.hasAttribute("data-ffad-fixture-control"), "Wrong element selected");
});

await test("unsupported and missing fixtures have no candidate", async () => {
  for (const name of ["unsupported", "missing-button"]) {
    const result = detectCandidate(await fixture(name), fixtureSelector);
    assert(result.status === "missing" && result.element === null, `${name} should be missing`);
  }
});

await test("multiple candidates are ambiguous", async () => {
  const result = detectCandidate(await fixture("ambiguous-button"), fixtureSelector);
  assert(result.status === "ambiguous" && result.count === 2 && result.element === null,
    "Ambiguous candidates must not select an element");
});

await test("disabled controls are excluded", async () => {
  const root = await fixture("missing-button");
  const disabled = document.createElement("button");
  disabled.setAttribute("data-ffad-fixture-control", "download");
  disabled.setAttribute("aria-disabled", "true");
  root.append(disabled);
  assert(detectCandidate(root, fixtureSelector).status === "missing", "Disabled control was selected");
});

await test("dynamic insertion is detected once and observer cleans up", async () => {
  const root = await fixture("dynamic-button");
  const statuses = [];
  watchForCandidate(root, fixtureSelector, (result) => statuses.push(result.status),
    { debounceMs: 15, timeoutMs: 150 });
  const control = document.createElement("a");
  control.setAttribute("data-ffad-fixture-control", "download");
  control.textContent = "DOWNLOAD";
  root.querySelector("#fixture-slot").append(control);
  await delay(50);
  assert(statuses.join(",") === "missing,candidate", `Unexpected statuses: ${statuses}`);
  root.querySelector("#fixture-slot").append(document.createElement("span"));
  await delay(40);
  assert(statuses.length === 2, "Observer remained active after candidate");
});

await test("rapid mutations are debounced", async () => {
  const root = await fixture("dynamic-button");
  const statuses = [];
  const disconnect = watchForCandidate(root, fixtureSelector,
    (result) => statuses.push(result.status), { debounceMs: 25, timeoutMs: 150 });
  const slot = root.querySelector("#fixture-slot");
  slot.append(document.createElement("span"));
  await delay(5);
  slot.append(document.createElement("span"));
  await delay(5);
  slot.append(document.createElement("span"));
  await delay(45);
  disconnect();
  assert(statuses.join(",") === "missing,missing", `Unexpected debounce statuses: ${statuses}`);
});

await test("observer expires without a candidate", async () => {
  const root = await fixture("dynamic-button");
  const statuses = [];
  watchForCandidate(root, fixtureSelector, (result) => statuses.push(result.status),
    { debounceMs: 10, timeoutMs: 25 });
  await delay(40);
  root.querySelector("#fixture-slot").append(document.createElement("button"));
  await delay(30);
  assert(statuses.join(",") === "missing", "Observer did not expire");
});

document.getElementById("results").textContent = JSON.stringify({ passed, failures });
