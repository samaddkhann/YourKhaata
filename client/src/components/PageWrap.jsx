import { motion } from "motion/react"

function PageWrap({ children }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
        >
            {children}
        </motion.div>
    )
}

export default PageWrap