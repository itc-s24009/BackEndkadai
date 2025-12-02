import { Router, Request, Response, NextFunction } from 'express'
import passport from '../libs/auth.js'
import argon2 from 'argon2'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// ==========================================
// ログイン画面 (GET)
// ==========================================
router.get('/login', async (req, res) => {
    res.render('users/login', {
        error: (req.session.messages || []).pop()
    })
})

// ==========================================
// ログイン処理 (POST) API & Form
// ==========================================
router.post('/login', (req: Request, res: Response, next: NextFunction) => {
    // passport.authenticate をカスタムコールバックで呼び出し、API/画面分岐を行う
    passport.authenticate('local', (err: any, user: any, info: any) => {
        if (err) return next(err)

        // ログイン失敗時
        if (!user) {
            // 修正: HTMLを「優先的に欲しがっている」場合以外は、全部JSONを返す
            // (これで curl でヘッダーを忘れても JSON が返りやすくなります)
            if (req.accepts('html') && !req.accepts('json')) {
                // ブラウザ用
                req.session.messages = [info ? info.message : 'ログイン失敗']
                return res.redirect('/users/login')
            } else {
                // API用
                return res.status(401).json({ message: '認証失敗' })
            }
        }
        // ログイン成功時 -> セッション確立
        req.logIn(user, (err) => {
            if (err) return next(err)

            // ★API仕様: JSON {"message": "ok"} を返す
            // ★画面仕様: 一覧画面へリダイレクト
            res.format({
                html: () => {
                    return res.redirect('/book/list/1')
                },
                json: () => {
                    return res.status(200).json({ message: 'ok' })
                }
            })
        })
    })(req, res, next)
})

// ==========================================
// 登録画面 (GET)
// ==========================================
router.get('/register', async (req, res) => {
    res.render('users/register', {
        error: (req.session.messages || []).pop()
    })
})

// ==========================================
// 登録処理 (POST) API & Form
// ==========================================
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, password } = req.body

        // 簡単なバリデーション (課題仕様によっては必須)
        if(!email || !name || !password) {
            throw new Error('パラメータ不足')
        }

        const hashedPassword = await argon2.hash(password)

        // ユーザー作成
        await prisma.user.create({
            data: {
                name: name,
                email: email,
                password: hashedPassword
            }
        })

        // 成功時のレスポンス
        res.format({
            html: () => {
                // 画面操作の場合は、ログイン画面へ移動
                res.redirect('/users/login')
            },
            json: () => {
                // API課題用: 何も返さず 200 OK
                res.status(200).send()
            }
        })

    } catch (error: any) {
        console.error("登録エラー:", error)

        // 失敗時のレスポンス
        res.format({
            html: () => {
                req.session.messages = ['登録に失敗しました']
                res.redirect('/users/register')
            },
            json: () => {
                // API課題用: 400 Bad Request
                // error.message や Prismaエラーコードから理由を設定するとベター
                res.status(400).json({ reason: error.message || '登録失敗' })
            }
        })
    }
})


// ==========================================
// 貸出記録 (GET) API & View
// ==========================================
router.get('/history', async (req, res, next) => {
    if (!req.user) {
        // 未ログイン時の対応
        res.format({
            html: () => res.redirect('/users/login'),
            json: () => res.status(401).json({ message: '未ログイン' })
        })
        return;
    }

    try {
        const logs = await prisma.rental_log.findMany({
            where: {
                user_id: (req.user as any).id
            },
            orderBy: {
                checkout_date: 'desc'
            }
        })

        const historyData = await Promise.all(logs.map(async (log: any) => {
            const book = await prisma.book.findUnique({
                where: { isbn: log.book_isbn }
            })
            return {
                id: log.id,
                book: {
                    isbn: log.book_isbn.toString(),
                    name: book ? book.title : '書籍不明'
                },
                checkout_date: log.checkout_date,
                due_date: log.due_date,
                returned_date: log.returned_date
            }
        }))

        // ★ API(JSON)と画面(Pug)の両方に対応
        res.format({
            html: () => {
                res.render('users/history', {
                    title: 'History',
                    history: historyData,
                    error: (req.session.messages || []).pop()
                })
            },
            json: () => {
                res.json({ history: historyData })
            }
        })

    } catch (error) {
        next(error)
    }
})


// ==========================================
// 名前変更画面 (GET)
// ==========================================
router.get('/change', (req, res) => {
    if (!req.user) return res.redirect('/users/login')

    res.render('users/change', {
        title: '名前変更',
        // @ts-ignore
        userName: req.user.name
    })
})

// ==========================================
// 名前変更処理 (PUT) API
// ==========================================
router.put('/change', async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ reason: 'ログインしていません' })
    }

    try {
        const newName = req.body.name

        if (!newName || typeof newName !== 'string' || newName.trim() === '') {
            return res.status(400).json({ reason: '名前が入力されていません' })
        }

        await prisma.user.update({
            where: {
                id: (req.user as any).id
            },
            data: {
                name: newName
            }
        })

        return res.status(200).json({
            message: '更新しました'
        })

    } catch (error) {
        console.error(error)
        return res.status(500).json({ reason: 'サーバーエラーが発生しました' })
    }
})


// ==========================================
// 返却手続き画面 (GET /users/return)
// ==========================================
router.get('/return', async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.redirect('/users/login')
    }

    try {
        // 未返却のログのみ取得
        const rentals = await prisma.rental_log.findMany({
            where: {
                user_id: (req.user as any).id,
                returned_date: { equals: null as any }
            },
            orderBy: {
                checkout_date: 'asc'
            }
        })

        const rentalData = await Promise.all(rentals.map(async (rental: any) => {
            const book = await prisma.book.findUnique({
                where: { isbn: rental.book_isbn }
            })
            return {
                id: rental.id,
                book: {
                    title: book ? book.title : '書籍不明',
                    isbn: rental.book_isbn.toString()
                },
                checkout_date: rental.checkout_date,
                due_date: rental.due_date
            }
        }))

        // Viewファイル指定 (必要なら書き換えてください)
        res.render('users/return', {
            title: '返却手続き',
            rentals: rentalData
        })

    } catch (error) {
        next(error)
    }
})

// ==========================================
// 返却実行 (PUT /users/return) API
// ==========================================
router.put('/return', async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ message: "ログインしてください" })
    }

    try {
        const rentalId = req.body.id

        // 1. 貸出記録検索
        const rental = await prisma.rental_log.findUnique({
            where: { id: rentalId }
        })

        if (!rental) {
            return res.status(404).json({ message: "存在しない貸出記録です" })
        }

        // 2. 本人確認
        if (rental.user_id !== (req.user as any).id) {
            return res.status(403).json({ message: "他のユーザの貸出書籍です" })
        }

        // 3. 返却処理
        const now = new Date()
        const updatedRental = await prisma.rental_log.update({
            where: { id: rentalId },
            data: {
                returned_date: now
            }
        })

        // 返却データを返す仕様
        return res.status(200).json({
            id: updatedRental.id,
            returned_date: updatedRental.returned_date
        })

    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: "サーバーエラーが発生しました" })
    }
})


export default router