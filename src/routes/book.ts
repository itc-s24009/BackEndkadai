import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()
const ITEMS_PER_PAGE = 5

// ==========================================
// 0. 検索機能 API & 中継
// ==========================================

// 仕様通りのAPI (GET + JSON Body) - テスト用
router.get('/search/author', async (req: Request, res: Response) => {
    try {
        const keyword = req.body.keyword || ''
        const authors = await prisma.author.findMany({
            where: {
                isDeleted: false,
                name: { contains: keyword } // 部分一致検索
            },
            select: { id: true, name: true }
        })
        res.json({ authors })
    } catch (e) {
        res.status(500).json({ message: 'Error' })
    }
})

router.get('/search/publisher', async (req: Request, res: Response) => {
    try {
        const keyword = req.body.keyword || ''
        const publishers = await prisma.publisher.findMany({
            where: {
                isDeleted: false,
                name: { contains: keyword }
            },
            select: { id: true, name: true }
        })
        res.json({ publishers })
    } catch (e) {
        res.status(500).json({ message: 'Error' })
    }
})


// ★画面(JS)から呼ぶためのブリッジAPI (POSTでパラメータ受け取り)
// ブラウザからはこちらを叩きます
router.post('/search/internal', async (req: Request, res: Response) => {
    try {
        const { type, keyword } = req.body

        if (type === 'author') {
            const authors = await prisma.author.findMany({
                where: { isDeleted: false, name: { contains: keyword } },
                select: { id: true, name: true }
            })
            return res.json({ type: 'author', results: authors })

        } else if (type === 'publisher') {
            const publishers = await prisma.publisher.findMany({
                where: { isDeleted: false, name: { contains: keyword } },
                select: { id: true, name: true }
            })
            return res.json({ type: 'publisher', results: publishers })
        }

        res.status(400).json({ message: 'Invalid type' })

    } catch (e) {
        console.error(e)
        res.status(500).json({ message: 'Internal Server Error' })
    }
})


// ==========================================
// 1. 書籍一覧機能 (GET /book/list)
// ==========================================

// (A) ページ指定あり
router.get('/list/:page', handleListRequest)
// (B) ページ指定なし（デフォルト1ページ目）
router.get('/list', handleListRequest)

// 共通処理関数
async function handleListRequest(req: Request, res: Response, next: NextFunction) {
    try {
        const pageParam = req.params.page || '1'
        let currentPage = parseInt(pageParam, 10)

        if (isNaN(currentPage) || currentPage < 1) {
            currentPage = 1
        }

        const totalCount = await prisma.book.count({
            where: { isDeleted: false }
        })
        const lastPage = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1

        if (currentPage > lastPage) {
            currentPage = lastPage
        }

        const booksRaw = await prisma.book.findMany({
            where: { isDeleted: false },
            take: ITEMS_PER_PAGE,
            skip: (currentPage - 1) * ITEMS_PER_PAGE,
            orderBy: [
                { publication_year: 'desc' },
                { publication_month: 'desc' }
            ]
        })

        const books = await Promise.all(booksRaw.map(async (book: any) => {
            const author = await prisma.author.findUnique({
                where: { id: book.author_id }
            })
            return {
                isbn: book.isbn.toString(),
                title: book.title,
                author: {
                    name: author ? author.name : '不明な著者'
                },
                publication_year_month: `${book.publication_year}.${book.publication_month}`
            }
        }))


        res.format({
            // ブラウザ（画面が見たい人）用
            html: () => {
                res.render('book/list', {
                    title: '書籍一覧',
                    data: {
                        current: currentPage,
                        last_page: lastPage,
                        books: books
                    }
                })
            },
            // APIクライアント（curl等、JSONが欲しい人）用
            json: () => {
                res.json({
                    current: currentPage,
                    last_page: lastPage,
                    books: books
                })
            }
        })

    } catch (error) {
        next(error)
    }
}

// ==========================================
// 2. 貸出機能 (POST /book/rental)
// ==========================================
router.post('/rental', async (req: Request, res: Response, next: NextFunction) => {
    // ログインしていなければエラー
    if (!req.user) {
        return res.status(401).json({ message: "ログインしてください" })
    }

    try {
        const bookId = req.body.book_id // ISBN

        // BigInt型変換でのエラーを防ぐため文字変換などを確認
        let isbn: bigint
        try {
            isbn = BigInt(bookId)
        } catch {
            return res.status(400).json({ message: "ISBNの形式が正しくありません" })
        }

        // 1. 書籍が存在するか確認 (404 check)
        const book = await prisma.book.findUnique({
            where: { isbn: isbn }
        })

        if (!book) {
            return res.status(404).json({ message: "書籍が存在しません" })
        }

        // 2. 既に貸出中か確認 (409 check)
        // returned_date が null (まだ返却していない) データがあるか探す
        const rental = await prisma.rental_log.findFirst({
            where: {
                book_isbn: isbn,
                returned_date: { equals: null as any } // NULL検索
            }
        })

        if (rental) {
            return res.status(409).json({ message: "既に貸出中です" })
        }

        // 3. 貸出処理を実行 (Create)
        const now = new Date()
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 7) // 7日後

        const newRental = await prisma.rental_log.create({
            data: {
                book_isbn: isbn,
                user_id: (req.user as any).id,
                checkout_date: now,
                due_date: dueDate,
                returned_date: null as any // 登録時はNULLで
            }
        })

        // 4. JSONレスポンス
        return res.status(200).json({
            id: newRental.id,
            checkout_date: newRental.checkout_date,
            due_date: newRental.due_date
        })

    } catch (error) {
        console.error(error)
        // 想定外エラー
        return res.status(500).json({ message: "サーバーエラーが発生しました" })
    }
})


// ==========================================
// 3. 書籍詳細機能 (GET /book/detail/:isbn)
// ==========================================
router.get('/detail/:isbn', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isbnStr = req.params.isbn
        let isbn: bigint
        try {
            isbn = BigInt(isbnStr)
        } catch {
            const err: any = new Error('ISBNの形式が正しくありません')
            err.status = 404
            throw err
        }

        // 1. 書籍検索
        const book = await prisma.book.findUnique({
            where: { isbn: isbn }
        })

        if (!book) {
            const err: any = new Error('書籍が見つかりません')
            err.status = 404
            throw err
        }

        // 2. 著者・出版社・貸出状況の取得
        const [author, publisher, activeRental] = await Promise.all([
            prisma.author.findUnique({ where: { id: book.author_id } }),
            prisma.publisher.findUnique({ where: { id: book.publisher_id } }),

            // ★貸出中チェック (returned_dateがNULLのものを探す)
            prisma.rental_log.findFirst({
                where: {
                    book_isbn: isbn,
                    returned_date: { equals: null as any }
                }
            })
        ])

        // 3. データ整形
        const detailData = {
            isbn: book.isbn.toString(),
            title: book.title,
            author: {
                name: author ? author.name : '不明'
            },
            publisher: {
                name: publisher ? publisher.name : '不明'
            },
            publication_year_month: `${book.publication_year}.${book.publication_month}`,

            // ★画面側でボタンを「貸出中(赤)」にするためのフラグ
            is_rental: !!activeRental
        }

        // 4. Pugを表示
        res.format({
            html: () => {
                res.render('book/detail', {
                    title: `詳細: ${book.title}`,
                    book: detailData
                })
            },
            json: () => {
                res.json(detailData) // API仕様のJSONを返す
            }
        })

    } catch (error) {
        next(error)
    }
})

export default router