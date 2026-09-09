import "@picocss/pico/css/pico.min.css";
import "../styles/main.css";
import { loadI18n } from "../lib/i18n.js";
import { applyI18n } from "../lib/applyI18n.js";
import { api, ApiError } from "../lib/api.js";
import { requireSession } from "../lib/auth.js";
import { resolveCurrentFarm } from "../lib/farmContext.js";

let session, farmId, t;
let peopleCache = [];

async function init() {
  const i18n = await loadI18n();
  t = i18n.t;
  document.documentElement.lang = i18n.locale;
  applyI18n(t);

  session = requireSession();
  if (!session) return;

  const farms = await api.myFarms(session.token).then((r) => r.farms).catch(() => []);
  const farm = resolveCurrentFarm(farms);

  if (!farm) {
    document.getElementById("people-section").hidden = true;
    document.getElementById("teams-section").hidden = true;
    document.getElementById("empty-state").hidden = false;
    return;
  }
  farmId = farm.id;
  document.getElementById("current-farm-name").textContent = farm.name;

  setupNewPersonForm();
  setupBulkImportForm();
  setupNewTeamForm();

  await refreshAll();
}

async function refreshAll() {
  const [people, teams] = await Promise.all([
    api.people(session.token, farmId).then((r) => r.people).catch(() => []),
    api.teams(session.token, farmId).then((r) => r.teams).catch(() => []),
  ]);
  peopleCache = people;
  renderPeople(people);
  renderTeams(teams);
}

function setupNewPersonForm() {
  const form = document.getElementById("new-person-form");
  const errorEl = document.getElementById("new-person-error");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    const data = new FormData(form);
    try {
      await api.createPerson(session.token, {
        farmId,
        firstName: data.get("firstName")?.trim(),
        lastName: data.get("lastName")?.trim(),
        roleTitle: data.get("roleTitle")?.trim() || undefined,
        email: data.get("email")?.trim() || undefined,
        phone: data.get("phone")?.trim() || undefined,
      });
      form.reset();
      await refreshAll();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : t("team.genericError");
      errorEl.hidden = false;
    }
  });
}

function parseBulkLines(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [firstName, lastName, roleTitle] = line.split(",").map((v) => v?.trim());
      return { firstName, lastName, roleTitle: roleTitle || undefined };
    });
}

function setupBulkImportForm() {
  const form = document.getElementById("bulk-import-form");
  const errorEl = document.getElementById("bulk-import-error");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    const raw = new FormData(form).get("lines") || "";
    const people = parseBulkLines(raw);
    if (people.length === 0) return;

    try {
      await api.createPeopleBulk(session.token, { farmId, people });
      form.reset();
      await refreshAll();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : t("team.genericError");
      errorEl.hidden = false;
    }
  });
}

function setupNewTeamForm() {
  const form = document.getElementById("new-team-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = new FormData(form).get("name")?.trim();
    if (!name) return;
    await api.createTeam(session.token, { farmId, name });
    form.reset();
    await refreshAll();
  });
}

function renderPeople(people) {
  const tbody = document.getElementById("people-body");
  const noneMsg = document.getElementById("no-people-message");
  tbody.innerHTML = "";
  noneMsg.hidden = people.length > 0;
  people.forEach((person) => tbody.appendChild(renderPersonRow(person)));
}

function renderPersonRow(person) {
  const tr = document.createElement("tr");

  const firstNameInput = textInput(person.first_name, (value) => patchPerson(person.id, { firstName: value }));
  const lastNameInput = textInput(person.last_name, (value) => patchPerson(person.id, { lastName: value }));
  const roleInput = textInput(person.role_title || "", (value) => patchPerson(person.id, { roleTitle: value }));
  const emailInput = textInput(person.email || "", (value) => patchPerson(person.id, { email: value }), "email");
  const phoneInput = textInput(person.phone || "", (value) => patchPerson(person.id, { phone: value }), "tel");

  const statusSelect = document.createElement("select");
  ["active", "inactive"].forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = t(`team.status_${status}`);
    if (status === person.status) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusSelect.addEventListener("change", () => patchPerson(person.id, { status: statusSelect.value }));

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "secondary";
  deleteBtn.textContent = t("team.delete");
  deleteBtn.addEventListener("click", async () => {
    if (!window.confirm(t("team.confirmRemovePerson"))) return;
    await api.deletePerson(session.token, person.id);
    await refreshAll();
  });

  [firstNameInput, lastNameInput, roleInput, emailInput, phoneInput, statusSelect, deleteBtn].forEach((el) => {
    const td = document.createElement("td");
    td.appendChild(el);
    tr.appendChild(td);
  });
  return tr;
}

function textInput(value, onChange, type = "text") {
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  input.addEventListener("change", () => onChange(input.value.trim()));
  return input;
}

async function patchPerson(personId, payload) {
  await api.updatePerson(session.token, personId, payload);
  const updated = await api.people(session.token, farmId).then((r) => r.people).catch(() => []);
  peopleCache = updated;
}

function renderTeams(teams) {
  const container = document.getElementById("teams-list");
  const noneMsg = document.getElementById("no-teams-message");
  container.innerHTML = "";
  noneMsg.hidden = teams.length > 0;
  teams.forEach((team) => container.appendChild(renderTeamCard(team)));
}

function renderTeamCard(team) {
  const article = document.createElement("article");

  const header = document.createElement("header");
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = team.name;
  nameInput.addEventListener("change", async () => {
    await api.renameTeam(session.token, team.id, nameInput.value.trim());
    await refreshAll();
  });
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "secondary";
  deleteBtn.textContent = t("team.delete");
  deleteBtn.addEventListener("click", async () => {
    if (!window.confirm(t("team.confirmRemoveTeam"))) return;
    await api.deleteTeam(session.token, team.id);
    await refreshAll();
  });
  header.append(nameInput, deleteBtn);
  article.appendChild(header);

  const memberList = document.createElement("ul");
  team.members.forEach((member) => {
    const li = document.createElement("li");
    li.textContent = `${member.first_name} ${member.last_name}${member.role_title ? ` (${member.role_title})` : ""} `;
    const removeBtn = document.createElement("button");
    removeBtn.className = "secondary team-member-remove";
    removeBtn.textContent = "×";
    removeBtn.title = t("team.removeFromTeam");
    removeBtn.addEventListener("click", async () => {
      await api.removeTeamMember(session.token, team.id, member.id);
      await refreshAll();
    });
    li.appendChild(removeBtn);
    memberList.appendChild(li);
  });
  article.appendChild(memberList);

  const availablePeople = peopleCache.filter((p) => !team.members.some((m) => m.id === p.id));
  if (availablePeople.length > 0) {
    const addForm = document.createElement("form");
    addForm.className = "team-add-member";
    const select = document.createElement("select");
    availablePeople.forEach((p) => {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = `${p.first_name} ${p.last_name}`;
      select.appendChild(option);
    });
    const addBtn = document.createElement("button");
    addBtn.type = "submit";
    addBtn.className = "secondary";
    addBtn.textContent = t("team.addToTeam");
    addForm.append(select, addBtn);
    addForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await api.addTeamMember(session.token, team.id, select.value);
      await refreshAll();
    });
    article.appendChild(addForm);
  }

  return article;
}

init();
