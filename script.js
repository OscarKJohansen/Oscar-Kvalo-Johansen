import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://xxosihnqadwnhexywxkn.supabase.co",
  "sb_publishable_VLHzIQQIQNiJA_KRKX9hZA_Bn6PIUO2",
);

const panel = document.getElementById("authPanel");
const openBtn = document.getElementById("authOpenBtn");
const closeBtn = document.getElementById("authCloseBtn");
const userBadge = document.getElementById("authUserBadge");
const loggedOut = document.getElementById("authLoggedOut");
const loggedIn = document.getElementById("authLoggedIn");
const whoami = document.getElementById("whoami");
const roleBadge = document.getElementById("roleBadge");
const tabButtons = document.querySelectorAll("[data-tab]");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginMsg = document.getElementById("loginMsg");
const signupMsg = document.getElementById("signupMsg");
const ordersHeading = document.getElementById("ordersHeading");
const ordersIntro = document.getElementById("ordersIntro");
const ordersCount = document.getElementById("ordersCount");
const ordersEmptyState = document.getElementById("ordersEmptyState");
const ordersTableWrap = document.getElementById("ordersTableWrap");
const ordersTableBody = document.getElementById("ordersTableBody");
const ordersUserColumn = document.getElementById("ordersUserColumn");
const orderForm = document.getElementById("orderForm");
const orderService = document.getElementById("orderService");
const orderTimer = document.getElementById("orderTimer");
const orderNotes = document.getElementById("orderNotes");
const orderMsg = document.getElementById("orderMsg");

let currentUser = null;
let currentRole = null;

openBtn.addEventListener("click", () => panel.classList.add("open"));
closeBtn.addEventListener("click", () => panel.classList.remove("open"));

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    loginForm.style.display = tab === "login" ? "" : "none";
    signupForm.style.display = tab === "signup" ? "" : "none";
  });
});

async function refreshAuthUI() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    currentUser = null;
    currentRole = null;
    openBtn.style.display = "";
    openBtn.textContent = "Logg inn";
    loggedOut.style.display = "";
    loggedIn.style.display = "none";
    userBadge.textContent = "";
    whoami.textContent = "";
    roleBadge.textContent = "";
    await renderOrders();
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "user";
  currentUser = user;
  currentRole = role;
  openBtn.style.display = "";
  openBtn.textContent = "Min profil";
  loggedOut.style.display = "none";
  loggedIn.style.display = "";
  whoami.textContent = `Innlogget som ${user.email}`;
  roleBadge.textContent = `Rolle: ${role}`;
  userBadge.textContent = role === "admin" ? "Admin" : "Innlogget";
  await renderOrders();
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("nb-NO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function renderOrders() {
  if (!ordersTableBody || !ordersEmptyState || !ordersTableWrap) {
    return;
  }

  if (!currentUser) {
    ordersHeading.textContent = "Logg inn for å se bestillingene dine";
    ordersIntro.textContent =
      "Brukere ser sine egne bestillinger. Admins ser alle bestillinger.";
    ordersCount.textContent = "";
    ordersUserColumn.style.display = "none";
    ordersTableBody.innerHTML = "";
    ordersTableWrap.style.display = "none";
    ordersEmptyState.style.display = "";
    ordersEmptyState.textContent = "Logg inn for å se bestillingene dine.";
    return;
  }

  const isAdmin = currentRole === "admin";
  ordersHeading.textContent = isAdmin
    ? "Alle bestillinger"
    : "Mine bestillinger";
  ordersIntro.textContent = isAdmin
    ? "Du ser alle bestillinger i systemet."
    : "Du ser bare bestillingene som er knyttet til kontoen din.";

  const query = supabase
    .from("bestilling")
    .select("id, created_at, status, timer, notes, user_id")
    .order("created_at", { ascending: false });

  const { data, error } = isAdmin
    ? await query
    : await query.eq("user_id", currentUser.id);

  if (error) {
    ordersCount.textContent = "";
    ordersTableWrap.style.display = "none";
    ordersEmptyState.style.display = "";
    ordersEmptyState.textContent = `Kunne ikke hente bestillinger: ${error.message}`;
    return;
  }

  const orders = data ?? [];
  ordersCount.textContent = `${orders.length} bestilling${orders.length === 1 ? "" : "er"}`;
  ordersUserColumn.style.display = isAdmin ? "" : "none";

  if (orders.length === 0) {
    ordersTableWrap.style.display = "none";
    ordersEmptyState.style.display = "";
    ordersEmptyState.textContent = isAdmin
      ? "Det finnes ingen bestillinger enda."
      : "Du har ingen bestillinger enda.";
    return;
  }

  ordersEmptyState.style.display = "none";
  ordersTableWrap.style.display = "";
  ordersTableBody.innerHTML = orders
    .map(
      (order) => `
        <tr>
          <td>${formatDate(order.created_at)}</td>
          <td><span class="badge text-bg-secondary">${order.status ?? "pending"}</span></td>
          <td>${order.timer ?? "-"}</td>
          <td>${order.notes ?? "-"}</td>
          ${isAdmin ? `<td><code>${order.user_id}</code></td>` : ""}
        </tr>
      `,
    )
    .join("");
}

async function createOrder() {
  if (!currentUser) {
    if (orderMsg) {
      orderMsg.textContent =
        "Du må logge inn før du kan opprette en bestilling.";
    }
    return;
  }

  const service = orderService?.value?.trim();
  const timerValue = orderTimer?.value;
  const notes = orderNotes?.value.trim() || null;

  if (!service || timerValue === "") {
    if (orderMsg) {
      orderMsg.textContent = "Velg en tjeneste og legg inn antall timer.";
    }
    return;
  }

  if (orderMsg) {
    orderMsg.textContent = "Lagrer bestilling...";
  }

  const { error } = await supabase.from("bestilling").insert([
    {
      user_id: currentUser.id,
      status: "pending",
      timer: Number(timerValue),
      notes: notes ? `${service}: ${notes}` : service,
    },
  ]);

  if (error) {
    if (orderMsg) {
      orderMsg.textContent = `Feil: ${error.message}`;
    }
    return;
  }

  if (orderForm) {
    orderForm.reset();
  }

  if (orderMsg) {
    orderMsg.textContent = "Bestilling opprettet ✅";
  }

  await renderOrders();
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMsg.textContent = "Logger inn...";

  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPass").value;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error) {
    loginMsg.textContent = "Feil: " + error.message;
  } else {
    loginMsg.textContent = "Innlogget ✅";
    await refreshAuthUI();
    setTimeout(() => panel.classList.remove("open"), 400);
  }
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupMsg.textContent = "Oppretter...";

  const name = document.getElementById("signupName").value.trim();
  const email = document
    .getElementById("signupEmail")
    .value.trim()
    .toLowerCase();
  const pass = document.getElementById("signupPass").value;

  const { error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: { data: { display_name: name } },
  });

  signupMsg.textContent = error
    ? "Feil: " + error.message
    : "Konto opprettet ✅ Sjekk e-posten din for bekreftelse.";
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
});

if (orderForm) {
  orderForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await createOrder();
  });
}

supabase.auth.onAuthStateChange(() => {
  refreshAuthUI();
});

refreshAuthUI();
