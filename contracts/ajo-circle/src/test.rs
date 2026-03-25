#![cfg(test)]

use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events},
    Address, Env, IntoVal, Symbol,
};

fn setup() -> (Env, Address, AjoCircleClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let organizer = Address::generate(&env);
    (env, organizer, client)
}

#[test]
fn test_initialize_emits_event() {
    let (env, organizer, client) = setup();
    client.initialize_circle(&organizer, &100, &7, &4, &0);

    let events = env.events().all();
    assert!(!events.is_empty());

    let last = events.last().unwrap();
    assert_eq!(last.1.get(0).unwrap(), Symbol::new(&env, "ajo").into_val(&env));
    assert_eq!(last.1.get(1).unwrap(), symbol_short!("init").into_val(&env));

    let (addr, amt, rounds): (Address, i128, u32) = last.2.into_val(&env);
    assert_eq!(addr, organizer);
    assert_eq!(amt, 100);
    assert_eq!(rounds, 4);
}

#[test]
fn test_join_circle_emits_event() {
    let (env, organizer, client) = setup();
    let member = Address::generate(&env);

    client.initialize_circle(&organizer, &100, &7, &4, &0);
    client.join_circle(&organizer, &member);

    let events = env.events().all();
    let last = events.last().unwrap();
    assert_eq!(last.1.get(0).unwrap(), Symbol::new(&env, "ajo").into_val(&env));
    assert_eq!(last.1.get(1).unwrap(), symbol_short!("joined").into_val(&env));

    let (addr, count): (Address, u32) = last.2.into_val(&env);
    assert_eq!(addr, member);
    assert_eq!(count, 2u32);
}

#[test]
fn test_contribute_emits_event() {
    let (env, organizer, client) = setup();
    client.initialize_circle(&organizer, &100, &7, &4, &0);
    client.contribute(&organizer, &100);

    let events = env.events().all();
    let last = events.last().unwrap();
    assert_eq!(last.1.get(0).unwrap(), Symbol::new(&env, "ajo").into_val(&env));
    assert_eq!(last.1.get(1).unwrap(), symbol_short!("paid").into_val(&env));

    let (addr, amt): (Address, i128) = last.2.into_val(&env);
    assert_eq!(addr, organizer);
    assert_eq!(amt, 100);
}

#[test]
fn test_claim_payout_emits_event() {
    let (env, organizer, client) = setup();
    client.initialize_circle(&organizer, &100, &7, &1, &0);
    let payout = client.claim_payout(&organizer);

    let events = env.events().all();
    let last = events.last().unwrap();
    assert_eq!(last.1.get(0).unwrap(), Symbol::new(&env, "ajo").into_val(&env));
    assert_eq!(last.1.get(1).unwrap(), symbol_short!("payout").into_val(&env));

    let (addr, amt): (Address, i128) = last.2.into_val(&env);
    assert_eq!(addr, organizer);
    assert_eq!(amt, payout);
}

#[test]
fn test_slash_and_disqualify() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let organizer = Address::generate(&env);
    let member = Address::generate(&env);

    client.initialize_circle(&organizer, &100_i128, &30_u32, &5_u32, &0_u32);
    client.join_circle(&organizer, &member);

    client.slash_member(&organizer, &member);
    client.slash_member(&organizer, &member);
    client.slash_member(&organizer, &member);

    let res = client.try_contribute(&member, &100_i128);
    assert!(res.is_err());

    let res = client.try_claim_payout(&member);
    assert_eq!(res, Err(Ok(AjoError::Disqualified)));
}

#[test]
fn test_grace_period_reset() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(&env, &contract_id);
    let organizer = Address::generate(&env);
    let member = Address::generate(&env);

    client.initialize_circle(&organizer, &100_i128, &30_u32, &5_u32, &0_u32);
    client.join_circle(&organizer, &member);

    client.slash_member(&organizer, &member);
    client.slash_member(&organizer, &member);

    client.contribute(&member, &100_i128);

    client.slash_member(&organizer, &member);
    client.slash_member(&organizer, &member);

    client.contribute(&member, &100_i128);

    let payout = client.claim_payout(&member);
    assert_eq!(payout, 200);
}

}
