import { notFound } from "next/navigation"
import { FinishedProductsData } from "@/lib/types"
import { FamilyDetailView } from "./FamilyDetailView"
import finishedProductsData from "@/data/finished-products.json"

const data: FinishedProductsData = finishedProductsData as FinishedProductsData

export function generateStaticParams() {
    return data.families.map((family) => ({
        family: family.slug,
    }))
}

interface PageProps {
    params: { family: string }
}

export default function FamilyCategoriesPage({ params }: PageProps) {
    const family = data.families.find(f => f.slug === params.family)

    if (!family) {
        notFound()
    }

    return <FamilyDetailView family={family} />
}
