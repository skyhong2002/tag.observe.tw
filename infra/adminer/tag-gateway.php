<?php
// Signs tag.observe.tw admins into Adminer as their own MariaDB account
// (docs/login.md). The gateway (app/src/admin/db-console.ts) checks the Google
// session, then forwards the request with X-Tag-Admin-Email and the shared
// secret. Requests without the secret, such as the tailnet entry on :11443,
// get Adminer's normal login form.
//
// TAG_ADMINER_ACCOUNTS: comma-separated email=db_user:password entries, kept in
// infra/.env and maintained by scripts/adminer-account.sh.

class TagGatewayLogin {
	private $server;
	private $account;

	function __construct($server) {
		$this->server = $server;
		$secret = (string) getenv('TAG_ADMINER_SECRET');
		$sent = (string) ($_SERVER['HTTP_X_TAG_ADMINER_SECRET'] ?? '');
		if (strlen($secret) < 32 || !hash_equals($secret, $sent)) return;
		$email = strtolower((string) ($_SERVER['HTTP_X_TAG_ADMIN_EMAIL'] ?? ''));
		$this->account = self::accounts()[$email] ?? null;
		if (!$this->account) {
			http_response_code(403);
			header('Content-Type: text/plain; charset=utf-8');
			exit("No database account for $email yet: run scripts/adminer-account.sh.\n");
		}
		// Not signed in as this admin's account in this Adminer session (new
		// session, expired, or another username in the URL): sign in now. Adminer
		// stores the password in the session and redirects to the account's URL.
		$username = $this->account['username'];
		$signedIn = ($_GET['server'] ?? '') === $server
			&& ($_GET['username'] ?? null) === $username
			&& isset($_SESSION['pwds']['server'][$server][$username]);
		if (!$signedIn) {
			$_POST = array('auth' => array(
				'driver' => 'server',
				'server' => $server,
				'username' => $username,
				'password' => $this->account['password'],
				'db' => $_GET['db'] ?? 'tag_observe',
			));
		}
	}

	private static function accounts() {
		$accounts = array();
		foreach (explode(',', (string) getenv('TAG_ADMINER_ACCOUNTS')) as $entry) {
			if (!preg_match('~^\s*([^=\s]+)=([A-Za-z0-9_]+):(\S+)\s*$~', $entry, $match)) continue;
			$accounts[strtolower($match[1])] = array('username' => $match[2], 'password' => $match[3]);
		}
		return $accounts;
	}

	// Whatever the URL or session says, a gateway request connects as its own admin.
	function credentials() {
		return $this->account ? array($this->server, $this->account['username'], $this->account['password']) : null;
	}

	function login($login, $password) {
		return $this->account ? $login === $this->account['username'] : null;
	}
}

return new TagGatewayLogin(getenv('ADMINER_DEFAULT_SERVER') ?: 'db');
