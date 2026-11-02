import { Plus, XMark } from "@medusajs/icons"
import { Button, Heading, IconButton, Input, Select, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { attributesApi, listCategories } from "../../lib/attributes-api"
import { categoryPaths } from "../../lib/category-paths"
import { describeError } from "../../lib/error-code"
import type { Attribute } from "../../lib/types"

type Row = {
  key: number
  category_id: string
  rank: string
  override: "inherit" | "yes" | "no"
}

const toOverride = (value: boolean | null): Row["override"] =>
  value === null ? "inherit" : value ? "yes" : "no"

const fromOverride = (value: Row["override"]): boolean | null =>
  value === "inherit" ? null : value === "yes"

const rowsOf = (attribute: Attribute): Row[] =>
  attribute.categories.map((link, index) => ({
    key: index,
    category_id: link.category_id,
    rank: String(link.rank),
    override: toOverride(link.required_override),
  }))

/**
 * The categories an attribute is linked to, each with a rank and an optional
 * "required" override. Subcategories inherit a link; the nearest link wins.
 * Saving replaces every link.
 */
export const CategoryLinks = ({ attribute }: { attribute: Attribute }) => {
  const queryClient = useQueryClient()
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: listCategories })
  const paths = useMemo(() => categoryPaths(categories ?? []), [categories])
  const sorted = useMemo(
    () => [...(categories ?? [])].sort((a, b) => (paths.get(a.id) ?? "").localeCompare(paths.get(b.id) ?? "")),
    [categories, paths]
  )

  const [rows, setRows] = useState<Row[]>(() => rowsOf(attribute))
  const [nextKey, setNextKey] = useState(1000)
  // Reset to the saved links when they change on the server (not on every refetch).
  const saved = JSON.stringify(attribute.categories)
  useEffect(() => {
    setRows(rowsOf(attribute))
  }, [saved])

  const save = useMutation({
    mutationFn: () =>
      attributesApi.setCategories(
        attribute.id,
        rows
          .filter((row) => row.category_id)
          .map((row) => ({
            category_id: row.category_id,
            rank: Number.parseInt(row.rank, 10) || 0,
            required_override: fromOverride(row.override),
          }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] })
      toast.success("Categories saved")
    },
    onError: (error) => toast.error(describeError(error)),
  })

  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  const chosen = new Set(rows.map((row) => row.category_id))
  const picked = rows.map((row) => row.category_id).filter(Boolean)
  const duplicate = new Set(picked).size !== picked.length

  return (
    <div className="flex flex-col gap-y-4 px-6 py-4">
      <div>
        <Heading level="h2">Categories</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Products in these categories, and in their subcategories, get this attribute. The
          nearest link decides the rank and whether it is required.
        </Text>
      </div>

      {rows.length === 0 && (
        <Text size="small" className="text-ui-fg-subtle">
          Not linked to any category yet, so no product has it.
        </Text>
      )}

      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[1fr_6rem_9rem_2rem] items-end gap-x-3">
          <div className="flex flex-col gap-y-1">
            <Text size="xsmall" className="text-ui-fg-subtle">
              Category
            </Text>
            <Select value={row.category_id} onValueChange={(value) => update(row.key, { category_id: value })}>
              <Select.Trigger>
                <Select.Value placeholder="Pick a category" />
              </Select.Trigger>
              <Select.Content>
                {sorted.map((category) => (
                  <Select.Item
                    key={category.id}
                    value={category.id}
                    disabled={chosen.has(category.id) && category.id !== row.category_id}
                  >
                    {paths.get(category.id) ?? category.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <div className="flex flex-col gap-y-1">
            <Text size="xsmall" className="text-ui-fg-subtle">
              Rank
            </Text>
            <Input
              type="number"
              min={0}
              value={row.rank}
              onChange={(event) => update(row.key, { rank: event.target.value })}
            />
          </div>
          <div className="flex flex-col gap-y-1">
            <Text size="xsmall" className="text-ui-fg-subtle">
              Required
            </Text>
            <Select
              value={row.override}
              onValueChange={(value) => update(row.key, { override: value as Row["override"] })}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="inherit">{attribute.required ? "Yes (default)" : "No (default)"}</Select.Item>
                <Select.Item value="yes">Yes</Select.Item>
                <Select.Item value="no">No</Select.Item>
              </Select.Content>
            </Select>
          </div>
          <IconButton
            type="button"
            variant="transparent"
            aria-label="Remove category"
            onClick={() => setRows((current) => current.filter((entry) => entry.key !== row.key))}
          >
            <XMark />
          </IconButton>
        </div>
      ))}

      {duplicate && (
        <Text size="small" className="text-ui-fg-error">
          A category is listed twice.
        </Text>
      )}

      <div className="flex items-center gap-x-2">
        <Button
          type="button"
          size="small"
          variant="secondary"
          onClick={() => {
            setRows((current) => [
              ...current,
              { key: nextKey, category_id: "", rank: String(current.length), override: "inherit" },
            ])
            setNextKey((key) => key + 1)
          }}
        >
          <Plus />
          Add category
        </Button>
        <Button
          type="button"
          size="small"
          isLoading={save.isPending}
          disabled={duplicate}
          onClick={() => save.mutate()}
        >
          Save categories
        </Button>
      </div>
    </div>
  )
}
