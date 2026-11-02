import { defineRouteConfig } from "@medusajs/admin-sdk"
import { EnvelopeSolid } from "@medusajs/icons"
import { Container, Drawer, Heading, Select, StatusBadge, Table, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../../lib/sdk"

type Status = "new" | "contacted" | "closed"

type Enquiry = {
  id: string
  name: string
  email: string
  phone: string | null
  message: string
  budget: string | null
  status: Status
  created_at: string
}

type ListResponse = { custom_enquiries: Enquiry[]; count: number; limit: number; offset: number }

const PAGE_SIZE = 20
const STATUSES: Status[] = ["new", "contacted", "closed"]
const STATUS_COLOR: Record<Status, "blue" | "orange" | "grey"> = { new: "blue", contacted: "orange", closed: "grey" }
const STATUS_LABEL: Record<Status, string> = { new: "New", contacted: "Contacted", closed: "Closed" }

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })

const preview = (text: string) => (text.length > 80 ? `${text.slice(0, 80).trimEnd()}...` : text)

const CustomEnquiriesPage = () => {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<Status | "all">("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["custom-enquiries", page, filter],
    queryFn: () =>
      sdk.client.fetch<ListResponse>("/admin/custom-enquiries", {
        query: { limit: PAGE_SIZE, offset: page * PAGE_SIZE, ...(filter === "all" ? {} : { status: filter }) },
      }),
  })

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      sdk.client.fetch(`/admin/custom-enquiries/${id}`, { method: "POST", body: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-enquiries"] })
      toast.success("Status updated")
    },
    onError: (error: Error) => toast.error(error.message || "Could not update the status"),
  })

  const rows = data?.custom_enquiries ?? []
  const count = data?.count ?? 0
  const selected = rows.find((row) => row.id === selectedId) ?? null

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Custom enquiries</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Requests from the "Have something in mind?" form, newest first.
          </Text>
        </div>
        <div className="w-40">
          <Select
            size="small"
            value={filter}
            onValueChange={(value) => {
              setFilter(value as Status | "all")
              setPage(0)
            }}
          >
            <Select.Trigger>
              <Select.Value placeholder="Status" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All statuses</Select.Item>
              {STATUSES.map((s) => (
                <Select.Item key={s} value={s}>
                  {STATUS_LABEL[s]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Text className="px-6 py-4 text-ui-fg-subtle">Loading...</Text>
      ) : isError ? (
        <Text className="px-6 py-4 text-ui-fg-error">Could not load the enquiries.</Text>
      ) : rows.length === 0 ? (
        <Text className="px-6 py-4 text-ui-fg-subtle">No enquiries yet.</Text>
      ) : (
        <>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Date</Table.HeaderCell>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Email</Table.HeaderCell>
                <Table.HeaderCell>Phone</Table.HeaderCell>
                <Table.HeaderCell>Budget</Table.HeaderCell>
                <Table.HeaderCell>Message</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
                  <Table.Cell className="whitespace-nowrap">{formatDate(row.created_at)}</Table.Cell>
                  <Table.Cell>{row.name}</Table.Cell>
                  <Table.Cell>{row.email}</Table.Cell>
                  <Table.Cell>{row.phone ?? "-"}</Table.Cell>
                  <Table.Cell>{row.budget ?? "-"}</Table.Cell>
                  <Table.Cell>{preview(row.message)}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={STATUS_COLOR[row.status]}>{STATUS_LABEL[row.status]}</StatusBadge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          <Table.Pagination
            count={count}
            pageSize={PAGE_SIZE}
            pageIndex={page}
            pageCount={Math.max(1, Math.ceil(count / PAGE_SIZE))}
            canPreviousPage={page > 0}
            canNextPage={(page + 1) * PAGE_SIZE < count}
            previousPage={() => setPage((p) => Math.max(0, p - 1))}
            nextPage={() => setPage((p) => p + 1)}
          />
        </>
      )}

      <Drawer open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <Drawer.Content>
          {selected && (
            <>
              <Drawer.Header>
                <Drawer.Title>{selected.name}</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
                <Text size="small" className="text-ui-fg-subtle">
                  {formatDate(selected.created_at)}
                </Text>
                <div>
                  <Text size="small" weight="plus">Email</Text>
                  <Text><a className="text-ui-fg-interactive" href={`mailto:${selected.email}`}>{selected.email}</a></Text>
                </div>
                <div>
                  <Text size="small" weight="plus">Phone</Text>
                  <Text>{selected.phone ?? "Not given"}</Text>
                </div>
                <div>
                  <Text size="small" weight="plus">Budget</Text>
                  <Text>{selected.budget ?? "Not given"}</Text>
                </div>
                <div>
                  <Text size="small" weight="plus">Message</Text>
                  <Text className="whitespace-pre-wrap">{selected.message}</Text>
                </div>
                <div>
                  <Text size="small" weight="plus" className="mb-1">Status</Text>
                  <Select
                    value={selected.status}
                    onValueChange={(value) => setStatus.mutate({ id: selected.id, status: value as Status })}
                    disabled={setStatus.isPending}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {STATUSES.map((s) => (
                        <Select.Item key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              </Drawer.Body>
            </>
          )}
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Custom enquiries",
  icon: EnvelopeSolid,
})

export default CustomEnquiriesPage
