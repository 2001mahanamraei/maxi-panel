const API_URL = "https://api.example.com"; // آدرس Worker خودت را وارد کن

const loginBox = document.getElementById("loginBox");
const dashboard = document.getElementById("dashboard");
const adminTokenInput = document.getElementById("adminToken");
const usersList = document.getElementById("usersList");

function getToken() {
  return localStorage.getItem("maxi_admin_token");
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = isError ? "error" : "success";

  setTimeout(() => {
    toast.className = "";
  }, 3500);
}

async function api(path, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "خطا در ارتباط با سرور");
  }

  return data;
}

async function loadUsers() {
  try {
    usersList.innerHTML = "<p>در حال دریافت کاربران...</p>";

    const data = await api("/api/admin/users");
    const users = data.users || [];

    if (!users.length) {
      usersList.innerHTML = "<p>هنوز کاربری ساخته نشده است.</p>";
      return;
    }

    usersList.innerHTML = users.map(user => {
      const subUrl = `${window.location.origin}/?sub=${user.subscription_token}`;
      const status = user.is_active ? "فعال" : "غیرفعال";

      return `
        <article class="user-card">
          <div class="user-top">
            <div>
              <strong>${escapeHtml(user.username)}</strong>
              <span class="badge ${user.is_active ? "active" : "inactive"}">${status}</span>
            </div>
            <button class="danger small" onclick="deleteUser('${user.id}')">حذف</button>
          </div>

          <p><b>انقضا:</b> ${user.expires_at ? new Date(user.expires_at).toLocaleString("fa-IR") : "بدون انقضا"}</p>

          <label>لینک اشتراک:</label>
          <div class="copy-row">
            <input value="${subUrl}" readonly id="sub-${user.id}" />
            <button class="secondary small" onclick="copyText('sub-${user.id}')">کپی</button>
          </div>
        </article>
      `;
    }).join("");
  } catch (error) {
    usersList.innerHTML = `<p class="error-text">${error.message}</p>`;
  }
}

async function createUser() {
  const username = document.getElementById("username").value.trim();
  const expiresAt = document.getElementById("expiresAt").value;
  const v2rayConfig = document.getElementById("v2rayConfig").value.trim();
  const wireguardConfig = document.getElementById("wireguardConfig").value.trim();

  if (!username) {
    showToast("نام کاربر را وارد کن.", true);
    return;
  }

  try {
    const result = await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        username,
        expires_at: expiresAt || null,
        v2ray_config: v2rayConfig,
        wireguard_config: wireguardConfig,
        is_active: true
      })
    });

    showToast(`کاربر ساخته شد. توکن: ${result.subscription_token.slice(0, 10)}...`);

    document.getElementById("username").value = "";
    document.getElementById("expiresAt").value = "";
    document.getElementById("v2rayConfig").value = "";
    document.getElementById("wireguardConfig").value = "";

    loadUsers();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function deleteUser(id) {
  if (!confirm("از حذف این کاربر مطمئن هستی؟")) return;

  try {
    await api(`/api/admin/users/${id}`, {
      method: "DELETE"
    });

    showToast("کاربر حذف شد.");
    loadUsers();
  } catch (error) {
    showToast(error.message, true);
  }
}

function copyText(elementId) {
  const input = document.getElementById(elementId);
  navigator.clipboard.writeText(input.value);
  showToast("کپی شد.");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  const token = adminTokenInput.value.trim();

  if (!token) {
    showToast("توکن ادمین را وارد کن.", true);
    return;
  }

  localStorage.setItem("maxi_admin_token", token);

  try {
    await loadUsers();
    loginBox.hidden = true;
    dashboard.hidden = false;
  } catch {
    localStorage.removeItem("maxi_admin_token");
    showToast("توکن اشتباه است یا Worker در دسترس نیست.", true);
  }
});

document.getElementById("createUserBtn").addEventListener("click", createUser);
document.getElementById("refreshBtn").addEventListener("click", loadUsers);

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("maxi_admin_token");
  dashboard.hidden = true;
  loginBox.hidden = false;
  adminTokenInput.value = "";
});

if (getToken()) {
  loginBox.hidden = true;
  dashboard.hidden = false;
  loadUsers();
}
