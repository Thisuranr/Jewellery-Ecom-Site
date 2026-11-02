import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Plus, TagSolid } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useState } from "react"
import { useNavigate } from "react-router-dom"
import { L10nInput } from "../../../components/l10n-input"
import { attributesApi } from "../../../lib/attributes-api"
import { describeError } from "../../../lib/error-code"
import { suggestHandle } from "../../../lib/handle"
import {
  ATTRIBUTE_TYPES,
  ATTRIBUTE_UNITS,
  AttributeType,
  emptyL10n,
  fromL10nForm,
  L10nForm,
} from "../../../lib/types"

const PAGE_SIZE = 20
const NO_UNIT = "__none__"

const typeLabel = (type: string) =>
  ATTRIBUTE_TYPES.find((entry) => entry.value === type)?.label.split(" (")[0] ?? type

const CreateAttributeDrawer = ({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [label, setLabel] = useState<L10nForm>(emptyL10n())
  const [handle, setHandle] = useState("")
  const [handleEdited, setHandleEdited] = useState(false)
  const [type, setType] = useState<AttributeType>("select")
  const [unit, setUnit] = useState(NO_UNIT)
  const [group, setGroup] = useState("")
  const [filterable, setFilterable] = useState(false)
  const [required, setRequired] = useState(false)
  const [rank, setRank] = useState("0")

  const create = useMutation({
    mutationFn: () =>
      attributesApi.create({
        handle,
        type,
        unit: type === "number" && unit !== NO_UNIT ? unit : null,
        group_handle: group.trim() || null,
        filterable,
        required,
        rank: Number.parseInt(rank, 10) || 0,
        label: fromL10nForm(label),
      }),
    onSuccess: ({ attribute }) => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] })
      toast.success(`Attribute "${attribute.label.en}" created`)
      onOpenChange(false)
      navigate(`/settings/attributes/${attribute.id}`)
    },
    onError: (error) => toast.error(describeError(error)),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate()
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <form onSubmit={submit} className="flex h-full flex-col overflow-hidden">
          <Drawer.Header>
            <Drawer.Title>Create attribute</Drawer.Title>
            <Drawer.Description>
              Options and categories are added on the next page.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
            <L10nInput
              label="Label"
              value={label}
              maxLength={100}
              onChange={(next) => {
                setLabel(next)
                if (!handleEdited) {
                  setHandle(suggestHandle(next.en))
                }
              }}
            />
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="attribute-handle" size="small" weight="plus">
                Handle *
              </Label>
              <Input
                id="attribute-handle"
                value={handle}
                maxLength={40}
                onChange={(event) => {
                  setHandle(event.target.value)
                  setHandleEdited(true)
                }}
              />
              <Text size="small" className="text-ui-fg-subtle">
                Lower case letters, digits and underscores, starting with a letter. It can&apos;t
                be changed later.
              </Text>
            </div>
            <div className="flex flex-col gap-y-1">
              <Label size="small" weight="plus">
                Type *
              </Label>
              <Select value={type} onValueChange={(value) => setType(value as AttributeType)}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {ATTRIBUTE_TYPES.map((entry) => (
                    <Select.Item key={entry.value} value={entry.value}>
                      {entry.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
              <Text size="small" className="text-ui-fg-subtle">
                It can&apos;t be changed later.
              </Text>
            </div>
            {type === "number" && (
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">
                  Unit
                </Label>
                <Select value={unit} onValueChange={setUnit}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={NO_UNIT}>No unit</Select.Item>
                    {ATTRIBUTE_UNITS.map((entry) => (
                      <Select.Item key={entry} value={entry}>
                        {entry}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="attribute-group" size="small" weight="plus">
                Group
              </Label>
              <Input
                id="attribute-group"
                value={group}
                maxLength={100}
                placeholder="style, size, care, specs"
                onChange={(event) => setGroup(event.target.value)}
              />
              <Text size="small" className="text-ui-fg-subtle">
                The heading in the product&apos;s specification table.
              </Text>
            </div>
            <div className="flex items-center justify-between gap-x-4">
              <div>
                <Label size="small" weight="plus">
                  Filterable
                </Label>
                <Text size="small" className="text-ui-fg-subtle">
                  Shoppers can filter by it.
                </Text>
              </div>
              <Switch checked={filterable} onCheckedChange={setFilterable} />
            </div>
            <div className="flex items-center justify-between gap-x-4">
              <div>
                <Label size="small" weight="plus">
                  Required
                </Label>
                <Text size="small" className="text-ui-fg-subtle">
                  Staff must fill it in before saving a product&apos;s attributes.
                </Text>
              </div>
              <Switch checked={required} onCheckedChange={setRequired} />
            </div>
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="attribute-rank" size="small" weight="plus">
                Rank
              </Label>
              <Input
                id="attribute-rank"
                type="number"
                min={0}
                value={rank}
                onChange={(event) => setRank(event.target.value)}
              />
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary" type="button">
                Cancel
              </Button>
            </Drawer.Close>
            <Button
              type="submit"
              isLoading={create.isPending}
              disabled={!label.en.trim() || !handle.trim()}
            >
              Create
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}

const AttributesPage = () => {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [creating, setCreating] = useState(false)

  const { data, isPending, error } = useQuery({
    queryKey: ["attributes", "list", search, offset],
    queryFn: () => attributesApi.list({ q: search || undefined, limit: PAGE_SIZE, offset }),
    placeholderData: keepPreviousData,
  })

  const count = data?.count ?? 0
  const from = count ? offset + 1 : 0
  const to = Math.min(offset + PAGE_SIZE, count)

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Attributes</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            What staff describe a product with, and what shoppers filter by.
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          <Input
            type="search"
            size="small"
            placeholder="Search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setOffset(0)
            }}
          />
          <Button size="small" variant="secondary" onClick={() => setCreating(true)}>
            <Plus />
            Create
          </Button>
        </div>
      </div>

      {error ? (
        <div className="px-6 py-4">
          <Text className="text-ui-fg-error">{describeError(error)}</Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Label</Table.HeaderCell>
              <Table.HeaderCell>Handle</Table.HeaderCell>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.HeaderCell>Group</Table.HeaderCell>
              <Table.HeaderCell>Flags</Table.HeaderCell>
              <Table.HeaderCell>Options</Table.HeaderCell>
              <Table.HeaderCell>Categories</Table.HeaderCell>
              <Table.HeaderCell>Products</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(data?.attributes ?? []).map((attribute) => (
              <Table.Row
                key={attribute.id}
                className="cursor-pointer"
                onClick={() => navigate(`/settings/attributes/${attribute.id}`)}
              >
                <Table.Cell>{attribute.label.en}</Table.Cell>
                <Table.Cell>
                  <code>{attribute.handle}</code>
                </Table.Cell>
                <Table.Cell>
                  {typeLabel(attribute.type)}
                  {attribute.unit ? ` (${attribute.unit})` : ""}
                </Table.Cell>
                <Table.Cell>{attribute.group_handle ?? "-"}</Table.Cell>
                <Table.Cell>
                  <div className="flex gap-x-1">
                    {attribute.filterable && <Badge size="2xsmall">Filter</Badge>}
                    {attribute.required && (
                      <Badge size="2xsmall" color="orange">
                        Required
                      </Badge>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell>{attribute.options.length || "-"}</Table.Cell>
                <Table.Cell>{attribute.categories.length || "-"}</Table.Cell>
                <Table.Cell>{attribute.value_count}</Table.Cell>
              </Table.Row>
            ))}
            {!isPending && !data?.attributes.length && (
              <Table.Row>
                <Table.Cell>
                  {search ? "No attribute matches the search." : "No attributes yet."}
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      )}

      <div className="flex items-center justify-between px-6 py-3">
        <Text size="small" className="text-ui-fg-subtle">
          {count ? `${from} - ${to} of ${count}` : ""}
        </Text>
        <div className="flex gap-x-2">
          <Button
            size="small"
            variant="secondary"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Previous
          </Button>
          <Button
            size="small"
            variant="secondary"
            disabled={offset + PAGE_SIZE >= count}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>

      {creating && <CreateAttributeDrawer open={creating} onOpenChange={setCreating} />}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Attributes",
  icon: TagSolid,
})

export default AttributesPage
