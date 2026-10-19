function json(data, status = 200, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
    }
  });
}

function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  return auth === `Bearer ${env.ADMIN_TOKEN}`;
}

function generateToken() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

async function getUserByToken(token, env) {
  return env.DB
    .prepare(`
      SELECT id, username, subscription_token, is_active, expires_at,
             v2ray_config, wireguard_config, created_at
      FROM users
      WHERE subscription_token = ?
    `)
    .bind(token)
    .first();
}

function userIsValid(user) {
  if (!user || user.is_active !== 1) return false;

  if (user.expires_at) {
    const expiry = new Date(user.expires_at);
    if (expiry < new Date()) return false;
  }

  return true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
        }
      });
    }

    // دریافت کانفیگ توسط کاربر
    // GET /api/sub/:token
    if (request.method === "GET" && path.startsWith("/api/sub/")) {
      const token = path.split("/").pop();
      const user = await getUserByToken(token, env);

      if (!userIsValid(user)) {
        return json({ error: "لینک اشتراک نامعتبر، غیرفعال یا منقضی است." }, 403, env);
      }

      return json({
        username: user.username,
        expires_at: user.expires_at,
        v2ray_config: user.v2ray_config || "",
        wireguard_config: user.wireguard_config || ""
      }, 200, env);
    }

    // همه مسیرهای پایین نیاز به دسترسی ادمین دارند
    if (!isAdmin(request, env)) {
      return json({ error: "دسترسی غیرمجاز است." }, 401, env);
    }

    // لیست کاربران
    if (request.method === "GET" && path === "/api/admin/users") {
      const result = await env.DB.prepare(`
        SELECT id, username, subscription_token, is_active, expires_at, created_at
        FROM users
        ORDER BY created_at DESC
      `).all();

      return json({ users: result.results }, 200, env);
    }

    // ساخت کاربر جدید
    if (request.method === "POST" && path === "/api/admin/users") {
      const body = await request.json();

      if (!body.username?.trim()) {
        return json({ error: "نام کاربر الزامی است." }, 400, env);
      }

      const id = crypto.randomUUID();
      const token = generateToken();

      await env.DB.prepare(`
        INSERT INTO users (
          id, username, subscription_token, is_active,
          expires_at, v2ray_config, wireguard_config
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.username.trim(),
        token,
        body.is_active === false ? 0 : 1,
        body.expires_at || null,
        body.v2ray_config || "",
        body.wireguard_config || ""
      ).run();

      return json({
        success: true,
        id,
        subscription_token: token
      }, 201, env);
    }

    // ویرایش کاربر
    // PATCH /api/admin/users/:id
    if (request.method === "PATCH" && path.startsWith("/api/admin/users/")) {
      const id = path.split("/").pop();
      const body = await request.json();

      await env.DB.prepare(`
        UPDATE users
        SET username = ?,
            is_active = ?,
            expires_at = ?,
            v2ray_config = ?,
            wireguard_config = ?
        WHERE id = ?
      `).bind(
        body.username,
        body.is_active ? 1 : 0,
        body.expires_at || null,
        body.v2ray_config || "",
        body.wireguard_config || "",
        id
      ).run();

      return json({ success: true }, 200, env);
    }

    // حذف کاربر
    if (request.method === "DELETE" && path.startsWith("/api/admin/users/")) {
      const id = path.split("/").pop();

      await env.DB.prepare(
        "DELETE FROM users WHERE id = ?"
      ).bind(id).run();

      return json({ success: true }, 200, env);
    }

    return json({ error: "مسیر پیدا نشد." }, 404, env);
  }
};
