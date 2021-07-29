const {Command, flags} = require('@oclif/command')
const {cli} = require('cli-ux')
const stripe = require('stripe')

class SubscriptionsCommand extends Command {
  async run() {
    const {args, flags} = this.parse(SubscriptionsCommand)
    const {source, destination} = args
    const sourceStripe = stripe(source)
    const destinationStripe = stripe(destination)
    let hasMore = true
    let startingAfter = flags.startAfter
    do {
      // eslint-disable-next-line no-await-in-loop
      const subscriptions = await sourceStripe.subscriptions.list({
        status: 'active',
        limit: 100,
        // eslint-disable-next-line camelcase
        starting_after: startingAfter,
      })
      startingAfter = subscriptions.data[subscriptions.data.length - 1].id
      hasMore = subscriptions.has_more
      for (const subscription of subscriptions.data) {
        cli.action.start(`Copying subscription ${subscription.id}...`)
        // eslint-disable-next-line no-await-in-loop
        const newSubscription = await destinationStripe.subscriptions.create({
          customer: subscription.customer,
          plan: subscription.plan.id,
          // eslint-disable-next-line camelcase
          billing_cycle_anchor: subscription.current_period_end,
          // eslint-disable-next-line camelcase
          proration_behavior: 'none',
        })
        cli.action.stop(`done. New subscription ID ${newSubscription.id}`)
        cli.action.start(`Cancelling old subscription ${subscription.id}...`)
        // eslint-disable-next-line no-await-in-loop
        await sourceStripe.subscriptions.update(subscription.id, {
          // eslint-disable-next-line camelcase
          cancel_at_period_end: true,
        })
        cli.action.stop()
      }
    } while (hasMore)
  }
}

SubscriptionsCommand.description = `Transfers subscriptions from one account to another
...
The script does 2 things, it copies subscriptions from source account to destination account and cancels old subscriptions to make sure that customers don't get charged twice.
`

SubscriptionsCommand.flags = {
  startAfter: flags.string({char: 's', description: 'subscription ID to start from'}),
}

SubscriptionsCommand.args = [
  {name: 'source', description: 'source account API token'},
  {name: 'destination', description: 'destination account API token'},
]

module.exports = SubscriptionsCommand
