import test, { after } from "node:test"
import assert from "node:assert/strict"
import express from "express"
import cookieParser from "cookie-parser"
import jwt from "jsonwebtoken"

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234"
const { default: isAuth } = await import("../middlewares/isAuth.js")

const app = express()
app.use(cookieParser())
app.get("/private", isAuth, (req, res) => res.json({ userId: req.userId }))
const server = app.listen(0)
const base = `http://localhost:${server.address().port}`
after(() => server.close())

const call = (token) => fetch(`${base}/private`, { headers: token ? { cookie: `token=${token}` } : {} })
const sign = (options = {}, secret = process.env.JWT_SECRET) =>
    jwt.sign({ userId: "user-1" }, secret, { expiresIn: "1h", issuer: "hisaab-ledger", ...options })

test("no cookie is rejected", async () => {
    assert.equal((await call()).status, 401)
})

test("a garbage token is rejected", async () => {
    assert.equal((await call("not-a-token")).status, 401)
})

test("a token signed with the wrong secret is rejected", async () => {
    assert.equal((await call(sign({}, "another-secret-another-secret-123456"))).status, 401)
})

test("a token from the wrong issuer is rejected", async () => {
    assert.equal((await call(sign({ issuer: "someone-else" }))).status, 401)
})

test("an expired token is rejected", async () => {
    assert.equal((await call(sign({ expiresIn: -10 }))).status, 401)
})

test("a valid token is accepted and gives the user id", async () => {
    const res = await call(sign())
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { userId: "user-1" })
})