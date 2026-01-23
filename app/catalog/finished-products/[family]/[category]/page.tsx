import { notFound } from "next/navigation"
import { FinishedProductsData } from "@/lib/types"
import { CategoryDetailView } from "./CategoryDetailView"
import finishedProductsData from "@/data/finished-products.json"

const data: FinishedProductsData = finishedProductsData as FinishedProductsData

export function generateStaticParams() {
    const params: { family: string; category: string }[] = []

    data.families.forEach((family) => {
        family.categories.forEach((category) => {
            params.push({
                family: family.slug,
                category: category.slug,
            })
        })
    })

    return params
}

interface PageProps {
    params: { family: string; category: string }
}

export default function CategoryPage({ params }: PageProps) {
    const family = data.families.find(f => f.slug === params.family)
    const category = family?.categories.find(c => c.slug === params.category)

    if (!family || !category) {
        notFound()
    }

    return <CategoryDetailView family={family} category={category} />
}
