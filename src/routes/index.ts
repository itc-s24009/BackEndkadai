import {Router} from 'express'

const router = Router()

/* Get home page. */
router.get('/', async (req, res, next) => {
    res.render('index', {title: 'Express'})
})

export default router