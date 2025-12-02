import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// ==========================================
// 共通ミドルウェア: 管理者権限チェック
// ==========================================
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    // 未ログインチェック
    if (!req.user || !(req.user as any).id) {
        if (req.accepts('json') && !req.accepts('html')) {
            return res.status(403).json({ message: 'ログインしていません' })
        }
        return res.redirect('/')
    }

    try {
        const currentUser = await prisma.user.findUnique({
            where: { id: (req.user as any).id }
        })

        const isAdmin = currentUser && (currentUser.is_admin === true || (currentUser.is_admin as any) === 1)

        if (!isAdmin) {
            if (req.accepts('json') && !req.accepts('html')) {
                return res.status(403).json({ message: '管理者権限がありません' })
            }
            return res.redirect('/')
        }
        next()
    } catch (e) {
        console.error(e)
        res.redirect('/')
    }
}

// -----------------------------------------------------------
// 1. 著者 (Author)
// -----------------------------------------------------------

// 一覧 GET
router.get('/author', requireAdmin, async (req, res, next) => {
    try {
        const authors = await prisma.author.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } })
        res.format({
            html: () => res.render('admin/author', { title: '著者管理', authors }),
            json: () => res.json({ authors })
        })
    } catch (err) { next(err) }
})

// 登録 POST
router.post('/author', requireAdmin, async (req, res) => {
    try {
        const { name } = req.body
        if (!name) throw new Error('著者名は必須です')
        const newAuthor = await prisma.author.create({ data: { name } })

        res.format({
            html: () => res.redirect('/admin/author'),
            json: () => res.status(200).json({ id: newAuthor.id, name: newAuthor.name })
        })
    } catch (err: any) {
        // エラー時の分岐
        res.format({
            html: () => res.redirect('/admin/author?error=failed'), // パラメータ等でエラー伝える
            json: () => res.status(400).json({ message: err.message || '登録失敗' })
        })
    }
})

// 更新 PUT
router.put('/author', requireAdmin, async (req, res) => {
    try {
        const { id, name } = req.body
        const updated = await prisma.author.update({ where: { id }, data: { name } })
        res.status(200).json({ id: updated.id, name: updated.name }) // AJAX/JSON前提なのでこのままでOK
    } catch (err) { res.status(400).json({ message: '更新失敗' }) }
})

// 削除 DELETE
router.delete('/author', requireAdmin, async (req, res) => {
    try {
        const { id } = req.body
        await prisma.author.update({ where: { id }, data: { isDeleted: true } })
        res.status(200).json({ message: '削除しました' })
    } catch (err) { res.status(400).json({ message: '削除失敗' }) }
})


// -----------------------------------------------------------
// 2. 出版社 (Publisher)
// -----------------------------------------------------------

// 一覧 GET
router.get('/publisher', requireAdmin, async (req, res, next) => {
    try {
        const publishers = await prisma.publisher.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } })
        res.format({
            html: () => res.render('admin/publisher', { title: '出版社管理', publishers }),
            json: () => res.json({ publishers })
        })
    } catch (err) { next(err) }
})

// 登録 POST
router.post('/publisher', requireAdmin, async (req, res) => {
    try {
        const { name } = req.body
        if (!name) throw new Error('出版社名は必須です')
        const newPub = await prisma.publisher.create({ data: { name } })

        res.format({
            html: () => res.redirect('/admin/publisher'),
            json: () => res.status(200).json({ id: newPub.id, name: newPub.name })
        })
    } catch (err: any) {
        res.format({
            html: () => res.redirect('/admin/publisher?error=failed'),
            json: () => res.status(400).json({ message: err.message || '登録失敗' })
        })
    }
})

// 更新 PUT
router.put('/publisher', requireAdmin, async (req, res) => {
    try {
        const { id, name } = req.body
        const updated = await prisma.publisher.update({ where: { id }, data: { name } })
        res.status(200).json({ id: updated.id, name: updated.name })
    } catch (err) { res.status(400).json({ message: '更新失敗' }) }
})

// 削除 DELETE
router.delete('/publisher', requireAdmin, async (req, res) => {
    try {
        const { id } = req.body
        await prisma.publisher.update({ where: { id }, data: { isDeleted: true } })
        res.status(200).json({ message: '削除しました' })
    } catch (err) { res.status(400).json({ message: '削除失敗' }) }
})


// -----------------------------------------------------------
// 3. 書籍 (Book)
// -----------------------------------------------------------

// 一覧 GET
router.get('/book', requireAdmin, async (req, res, next) => {
    try {
        const booksRaw = await prisma.book.findMany({
            where: { isDeleted: false },
            orderBy: [{ publication_year: 'desc' }, { publication_month: 'desc' }]
        })

        // 書籍リスト結合処理
        const books = await Promise.all(booksRaw.map(async (book: any) => {
            const author = await prisma.author.findUnique({ where: { id: book.author_id } })
            const publisher = await prisma.publisher.findUnique({ where: { id: book.publisher_id } })
            return {
                isbn: book.isbn.toString(),
                title: book.title,
                authorName: author ? author.name : '不明',
                publisherName: publisher ? publisher.name : '不明',
                publication_year_month: `${book.publication_year}.${book.publication_month}`,
                author_id: book.author_id,
                publisher_id: book.publisher_id,
                year: book.publication_year,
                month: book.publication_month
            }
        }))

        // フォーム用選択リスト
        const [authors, publishers] = await Promise.all([
            prisma.author.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } }),
            prisma.publisher.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } })
        ])

        res.format({
            html: () => res.render('admin/book', { title: '書籍管理', books, authors, publishers }),
            json: () => res.json({ books })
        })
    } catch (err) { next(err) }
})

// 登録 POST
router.post('/book', requireAdmin, async (req, res) => {
    try {
        const { isbn, title, author_id, publisher_id, publication_year, publication_month } = req.body

        // バリデーション等
        if (!isbn || !title) throw new Error('必須項目不足')
        let isbnBig: bigint
        try { isbnBig = BigInt(isbn) } catch { throw new Error('ISBN形式エラー') }

        // 重複チェック
        const exists = await prisma.book.findUnique({ where: { isbn: isbnBig } })
        if (exists && !exists.isDeleted) throw new Error('登録済みISBN')

        // 登録
        await prisma.book.create({
            data: {
                isbn: isbnBig, title, author_id, publisher_id,
                publication_year: parseInt(publication_year),
                publication_month: parseInt(publication_month)
            }
        })

        res.format({
            html: () => res.redirect('/admin/book'),
            json: () => res.status(200).json({ message: '登録しました' })
        })
    } catch (err: any) {
        console.error(err)
        res.format({
            html: () => res.redirect('/admin/book?error=failed'),
            json: () => res.status(400).json({ message: err.message || '登録失敗' })
        })
    }
})

// 更新 PUT
router.put('/book', requireAdmin, async (req, res) => {
    try {
        const { isbn, title, author_id, publisher_id, publication_year, publication_month } = req.body
        const isbnBig = BigInt(isbn)

        await prisma.book.update({
            where: { isbn: isbnBig },
            data: {
                title, author_id, publisher_id,
                publication_year: parseInt(publication_year),
                publication_month: parseInt(publication_month)
            }
        })
        return res.status(200).json({ message: '更新しました' })

    } catch (err: any) {
        // 更新エラー (存在しないISBN等)
        return res.status(400).json({ message: err.message || '更新失敗' })
    }
})

// 削除 DELETE
router.delete('/book', requireAdmin, async (req, res) => {
    try {
        const { isbn } = req.body
        await prisma.book.update({
            where: { isbn: BigInt(isbn) },
            data: { isDeleted: true }
        })
        return res.status(200).json({ message: '削除しました' })
    } catch (err: any) {
        return res.status(400).json({ message: '削除失敗' })
    }
})

export default router